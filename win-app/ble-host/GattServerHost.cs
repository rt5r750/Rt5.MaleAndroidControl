using System.Text;
using Windows.Devices.Bluetooth;
using Windows.Devices.Bluetooth.Advertisement;
using Windows.Devices.Bluetooth.GenericAttributeProfile;
using Windows.Storage.Streams;

namespace RobotControl.BleHost;

/// <summary>
/// 与 master-app RobotGattServer 对齐的 GATT Service 7500 外设宿主：
/// 7 个特征（Mode/Emotion/Tasks/Voice/Heartbeat/ApiKey/UiLang），分片 0x7E、心跳 5s、0xFF 手动断开、API Key 转发。
/// </summary>
public sealed class GattServerHost : IAsyncDisposable
{
    public static readonly Guid ServiceUuid = new("00007500-0000-1000-8000-00805f9b34fb");
    public static readonly Guid ModeUuid = new("00007501-0000-1000-8000-00805f9b34fb");
    public static readonly Guid EmotionUuid = new("00007502-0000-1000-8000-00805f9b34fb");
    public static readonly Guid TasksUuid = new("00007503-0000-1000-8000-00805f9b34fb");
    public static readonly Guid VoiceUuid = new("00007504-0000-1000-8000-00805f9b34fb");
    public static readonly Guid HeartbeatUuid = new("00007505-0000-1000-8000-00805f9b34fb");
    public static readonly Guid ApiKeyUuid = new("00007506-0000-1000-8000-00805f9b34fb");
    public static readonly Guid UiLangUuid = new("00007507-0000-1000-8000-00805f9b34fb");

    public const string DeviceName = "RobotControl-Win";

    private const byte ChunkMagic = 0x7E;
    private const int ChunkHeaderSize = 3;
    private const int DefaultMtu = 23;
    private const int HeartbeatIntervalMs = 5000;

    private readonly object _lock = new();
    private readonly Dictionary<Guid, byte[]> _values = new();
    private readonly Dictionary<Guid, GattLocalCharacteristic> _characteristics = new();
    private readonly HashSet<string> _subscriberIds = new();

    private BluetoothAdapter? _adapter;
    private GattServiceProvider? _provider;
    private BluetoothLEAdvertisementPublisher? _namePublisher;
    private Timer? _heartbeatTimer;
    private bool _started;
    private bool _advertising;
    private bool _disposed;

    public string LastError { get; private set; } = "";
    public bool IsReady => _started && _provider != null;

    /// <summary>当前状态：0=未绑定 1=已连接 3=广告中/连接中</summary>
    public int CurrentState
    {
        get
        {
            if (!_advertising) return 0;
            lock (_lock) return _subscriberIds.Count > 0 ? 1 : 3;
        }
    }

    public event Action<HostInfo>? Ready;
    public event Action? AdvertisingStarted;
    public event Action? AdvertisingStopped;
    public event Action<string>? DeviceConnected;
    public event Action? AllDevicesDisconnected;
    public event Action? ManualDisconnectReceived;
    public event Action<string>? ApiKeyReceived;
    /// <summary>反向模式推送：客户端写入 Mode(7501) 且 ordinal ∈ 0..3 时触发</summary>
    public event Action<int>? ModeReceived;
    public event Action<string>? Error;
    public event Action<string, string>? Log;

    /// <summary>确保服务与特征已创建（幂等）。返回是否就绪。</summary>
    public async Task<bool> EnsureStartedAsync()
    {
        if (_started && _provider != null) return true;
        LastError = "";
        try
        {
            _adapter = await BluetoothAdapter.GetDefaultAsync();
            if (_adapter == null)
            {
                LastError = "未找到蓝牙适配器";
                Error?.Invoke(LastError);
                return false;
            }
            if (!_adapter.IsPeripheralRoleSupported)
            {
                LastError = "当前蓝牙适配器不支持外设（Peripheral）广播模式";
                Error?.Invoke(LastError);
                return false;
            }

            var createResult = await GattServiceProvider.CreateAsync(ServiceUuid);
            if (createResult.Error != BluetoothError.Success || createResult.ServiceProvider == null)
            {
                LastError = $"GATT 服务创建失败：{createResult.Error}";
                Error?.Invoke(LastError);
                return false;
            }
            _provider = createResult.ServiceProvider;
            _provider.AdvertisementStatusChanged += (s, e) =>
            {
                Log?.Invoke("info", $"广告状态：{_provider?.AdvertisementStatus}");
            };

            // Mode(7501)：Read|Write|Notify —— 客户端（slave-app）可写入 ordinal 反向切换控制台模式
            await AddCharacteristicAsync(ModeUuid, "Mode", GattCharacteristicProperties.Read | GattCharacteristicProperties.Write | GattCharacteristicProperties.Notify);
            await AddCharacteristicAsync(EmotionUuid, "Emotion", GattCharacteristicProperties.Read | GattCharacteristicProperties.Notify);
            await AddCharacteristicAsync(TasksUuid, "Tasks", GattCharacteristicProperties.Read | GattCharacteristicProperties.Notify);
            await AddCharacteristicAsync(VoiceUuid, "Voice", GattCharacteristicProperties.Read | GattCharacteristicProperties.Notify);
            await AddCharacteristicAsync(HeartbeatUuid, "Heartbeat", GattCharacteristicProperties.Read | GattCharacteristicProperties.Write | GattCharacteristicProperties.Notify);
            await AddCharacteristicAsync(ApiKeyUuid, "ApiKey", GattCharacteristicProperties.Read | GattCharacteristicProperties.Write | GattCharacteristicProperties.Notify);
            await AddCharacteristicAsync(UiLangUuid, "UiLang", GattCharacteristicProperties.Read | GattCharacteristicProperties.Notify);

            if (_characteristics.Count < 7)
            {
                LastError = "GATT 特征创建不完整";
                Error?.Invoke(LastError);
                return false;
            }

            lock (_lock)
            {
                _values[ModeUuid] = new byte[] { 0xFF };
                _values[EmotionUuid] = new byte[] { 100, 0, 100, 50 };
                _values[TasksUuid] = Array.Empty<byte>();
                _values[VoiceUuid] = Array.Empty<byte>();
                _values[HeartbeatUuid] = new byte[] { 0x01 };
                _values[ApiKeyUuid] = Array.Empty<byte>();
                _values[UiLangUuid] = new byte[] { 0x00 };
            }

            _started = true;
            Ready?.Invoke(new HostInfo
            {
                Supported = true,
                Mac = FormatMacAddress(_adapter.BluetoothAddress),
                Name = DeviceName
            });
            Log?.Invoke("info", "GATT 服务就绪，等待广播");
            return true;
        }
        catch (Exception ex)
        {
            LastError = $"BLE 初始化失败：{ex.Message}";
            Error?.Invoke(LastError);
            return false;
        }
    }

    public void StartAdvertising()
    {
        if (!_started || _provider == null || _advertising) return;
        try
        {
            var parameters = new GattServiceProviderAdvertisingParameters
            {
                IsConnectable = true,
                IsDiscoverable = true
            };
            _provider.StartAdvertising(parameters);
            _advertising = true;
            StartNamePublisher();
            StartHeartbeat();
            AdvertisingStarted?.Invoke();
            Log?.Invoke("info", "已开始 BLE 广告");
        }
        catch (Exception ex)
        {
            LastError = $"广告启动失败：{ex.Message}";
            Error?.Invoke(LastError);
        }
    }

    public void StopAdvertising(bool sendDisconnect)
    {
        if (sendDisconnect && _advertising)
        {
            _ = NotifyAsync(HeartbeatUuid, new byte[] { 0xFF });
        }
        StopHeartbeat();
        try { _provider?.StopAdvertising(); } catch { }
        _namePublisher?.Stop();
        _namePublisher = null;
        _advertising = false;
        lock (_lock)
        {
            _subscriberIds.Clear();
        }
        AdvertisingStopped?.Invoke();
    }

    /// <summary>更新特征值并通知所有已订阅客户端（自动分片）。</summary>
    public async Task UpdateValueAsync(Guid uuid, byte[] value)
    {
        lock (_lock) _values[uuid] = value;
        await NotifyAsync(uuid, value);
    }

    private async Task AddCharacteristicAsync(Guid uuid, string description, GattCharacteristicProperties properties)
    {
        if (_provider == null) return;
        try
        {
            var parameters = new GattLocalCharacteristicParameters
            {
                CharacteristicProperties = properties,
                ReadProtectionLevel = GattProtectionLevel.Plain,
                WriteProtectionLevel = GattProtectionLevel.Plain,
                UserDescription = description
            };
            var result = await _provider.Service.CreateCharacteristicAsync(uuid, parameters);
            if (result.Error != BluetoothError.Success || result.Characteristic == null)
            {
                Log?.Invoke("warn", $"特征 {uuid} 创建失败：{result.Error}");
                return;
            }
            var ch = result.Characteristic;
            _characteristics[uuid] = ch;
            ch.ReadRequested += OnReadRequested;
            ch.WriteRequested += OnWriteRequested;
            ch.SubscribedClientsChanged += OnSubscribedClientsChanged;
        }
        catch (Exception ex)
        {
            Log?.Invoke("warn", $"特征 {uuid} 创建异常：{ex.Message}");
        }
    }

    private async void OnReadRequested(GattLocalCharacteristic sender, GattReadRequestedEventArgs args)
    {
        var deferral = args.GetDeferral();
        try
        {
            var request = await args.GetRequestAsync();
            byte[] value;
            lock (_lock) value = _values.TryGetValue(sender.Uuid, out var v) ? v : Array.Empty<byte>();
            var offset = (int)Math.Min((uint)request.Offset, (uint)value.Length);
            var remaining = value.AsSpan(offset).ToArray();
            request.RespondWithValue(ToBuffer(remaining));
        }
        catch (Exception ex)
        {
            Log?.Invoke("warn", $"read {sender.Uuid} 失败：{ex.Message}");
        }
        finally
        {
            deferral.Complete();
        }
    }

    private async void OnWriteRequested(GattLocalCharacteristic sender, GattWriteRequestedEventArgs args)
    {
        var deferral = args.GetDeferral();
        try
        {
            var request = await args.GetRequestAsync();
            var data = ReadBuffer(request.Value);
            lock (_lock) _values[sender.Uuid] = data;
            if (request.Option == GattWriteOption.WriteWithResponse)
            {
                try { request.Respond(); } catch { }
            }

            if (sender.Uuid == HeartbeatUuid)
            {
                if (data.Length > 0 && data[0] == 0xFF)
                {
                    ManualDisconnectReceived?.Invoke();
                }
                else
                {
                    _ = NotifyAsync(HeartbeatUuid, data);
                }
            }
            else if (sender.Uuid == ApiKeyUuid && data.Length > 0)
            {
                ApiKeyReceived?.Invoke(Encoding.UTF8.GetString(data));
            }
            else if (sender.Uuid == ModeUuid && data.Length > 0)
            {
                var ordinal = data[0] & 0xFF;
                if (ordinal >= 0 && ordinal <= 3)
                {
                    ModeReceived?.Invoke(ordinal);
                }
            }
        }
        catch (Exception ex)
        {
            Log?.Invoke("warn", $"write {sender.Uuid} 失败：{ex.Message}");
        }
        finally
        {
            deferral.Complete();
        }
    }

    private void OnSubscribedClientsChanged(GattLocalCharacteristic sender, object args)
    {
        RecomputeSubscribers();
    }

    private void RecomputeSubscribers()
    {
        HashSet<string> previous;
        lock (_lock)
        {
            previous = new HashSet<string>(_subscriberIds);
        }

        var current = new HashSet<string>();
        foreach (var kv in _characteristics)
        {
            foreach (var client in kv.Value.SubscribedClients)
            {
                var session = client.Session;
                if (session == null) continue;
                var id = session.DeviceId.Id;
                current.Add(id);
                TrackSession(id, session);
            }
        }

        bool wasEmpty = previous.Count == 0;
        bool isEmpty = current.Count == 0;
        lock (_lock)
        {
            _subscriberIds.Clear();
            _subscriberIds.UnionWith(current);
        }

        if (wasEmpty && !isEmpty)
        {
            DeviceConnected?.Invoke(current.First());
        }
        else if (!wasEmpty && isEmpty)
        {
            AllDevicesDisconnected?.Invoke();
        }
    }

    private void TrackSession(string subscriberId, GattSession session)
    {
        lock (_lock)
        {
            if (_subscriberIds.Contains(subscriberId)) return;
        }
        session.MaxPduSizeChanged += (s, e) =>
        {
            Log?.Invoke("info", $"会话 {subscriberId} MTU 更新为 {session.MaxPduSize}");
        };
    }

    private async Task NotifyAsync(Guid uuid, byte[] value)
    {
        if (!_characteristics.TryGetValue(uuid, out var ch)) return;
        var clients = ch.SubscribedClients.ToList();
        if (clients.Count == 0) return;

        foreach (var client in clients)
        {
            int maxPayload = GetMaxPayload(client);
            if (value.Length <= maxPayload)
            {
                await ch.NotifyValueAsync(ToBuffer(value), client);
                continue;
            }

            int chunkPayload = Math.Max(1, maxPayload - ChunkHeaderSize);
            int totalChunks = (value.Length + chunkPayload - 1) / chunkPayload;
            if (totalChunks > 255)
            {
                Log?.Invoke("warn", $"数据过大：{value.Length} 字节共 {totalChunks} 片（超过 255 片上限）");
            }
            for (int i = 0; i < totalChunks; i++)
            {
                int start = i * chunkPayload;
                int payloadLen = Math.Min(chunkPayload, value.Length - start);
                var chunk = new byte[ChunkHeaderSize + payloadLen];
                chunk[0] = ChunkMagic;
                chunk[1] = (byte)(i & 0xFF);
                chunk[2] = (byte)(totalChunks & 0xFF);
                System.Buffer.BlockCopy(value, start, chunk, ChunkHeaderSize, payloadLen);
                await ch.NotifyValueAsync(ToBuffer(chunk), client);
                if (i < totalChunks - 1) await Task.Delay(20);
            }
        }
    }

    private static int GetMaxPayload(GattSubscribedClient client)
    {
        try
        {
            if (client.MaxNotificationSize > 0) return client.MaxNotificationSize;
            if (client.Session != null && client.Session.MaxPduSize > 0)
            {
                return Math.Max(1, client.Session.MaxPduSize - 3);
            }
        }
        catch { }
        return DefaultMtu - 3;
    }

    private void StartNamePublisher()
    {
        try
        {
            var publisher = new BluetoothLEAdvertisementPublisher();
            publisher.Advertisement.LocalName = DeviceName;
            publisher.Advertisement.DataSections.Add(
                new BluetoothLEAdvertisementDataSection(
                    BluetoothLEAdvertisementDataTypes.CompleteService128BitUuids,
                    ToBuffer(ServiceUuid.ToByteArray())));
            publisher.StatusChanged += (s, e) => { };
            publisher.Start();
            _namePublisher = publisher;
        }
        catch
        {
            try { _namePublisher?.Stop(); } catch { }
            _namePublisher = null;
            // 名称/服务数据广告失败不影响 GattServiceProvider 主广告
        }
    }

    private void StartHeartbeat()
    {
        if (_heartbeatTimer != null) return;
        _heartbeatTimer = new Timer(async _ =>
        {
            try
            {
                await NotifyAsync(HeartbeatUuid, new byte[] { 0x01 });
            }
            catch (Exception ex)
            {
                Log?.Invoke("warn", $"心跳推送失败：{ex.Message}");
            }
        }, null, TimeSpan.FromMilliseconds(HeartbeatIntervalMs), TimeSpan.FromMilliseconds(HeartbeatIntervalMs));
    }

    private void StopHeartbeat()
    {
        _heartbeatTimer?.Dispose();
        _heartbeatTimer = null;
    }

    private static byte[] ReadBuffer(IBuffer buffer)
    {
        if (buffer == null || buffer.Length == 0) return Array.Empty<byte>();
        var result = new byte[buffer.Length];
        DataReader.FromBuffer(buffer).ReadBytes(result);
        return result;
    }

    private static IBuffer ToBuffer(byte[] data)
    {
        var writer = new DataWriter();
        writer.WriteBytes(data);
        return writer.DetachBuffer();
    }

    /// <summary>
    /// 将 Windows BluetoothAdapter.BluetoothAddress（UInt64）格式化为 MAC。
    /// 若 AVD/真机展示的地址与二维码不一致，需反转字节序（见 FormatMacAddress 注释）。
    /// </summary>
    private static string FormatMacAddress(ulong address)
    {
        var hex = address.ToString("X12");
        if (hex.Length != 12) hex = hex.PadLeft(12, '0');
        return string.Join(":", Enumerable.Range(0, 6).Select(i => hex.Substring(i * 2, 2)));
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        StopAdvertising(sendDisconnect: true);
        await Task.Delay(100);
        _provider = null;
        _started = false;
    }
}
