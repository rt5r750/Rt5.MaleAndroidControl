using System.Text.Json;

namespace RobotControl.BleHost;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        var pipeName = GetArg(args, "--pipe") ?? $"robotcontrol-ble-{Environment.ProcessId}";
        var host = new GattServerHost();
        var transport = new PipeTransport(pipeName);

        transport.OnMessage += message => HandleMessageAsync(host, transport, message);

        host.Ready += info => _ = transport.SendAsync(new { type = "ready", supported = info.Supported, mac = info.Mac, name = info.Name, error = info.Error ?? "" });
        host.AdvertisingStarted += () => _ = transport.SendAsync(new { type = "advertising-started" });
        host.AdvertisingStopped += () => _ = transport.SendAsync(new { type = "advertising-stopped" });
        host.DeviceConnected += address => _ = transport.SendAsync(new { type = "device-connected", address });
        host.AllDevicesDisconnected += () => _ = transport.SendAsync(new { type = "device-disconnected" });
        host.ManualDisconnectReceived += () => _ = transport.SendAsync(new { type = "manual-disconnect" });
        host.ApiKeyReceived += key => _ = transport.SendAsync(new { type = "apikey", key });
        host.ModeReceived += ordinal => _ = transport.SendAsync(new { type = "mode", ordinal });
        host.Error += message => _ = transport.SendAsync(new { type = "error", message });
        host.Log += (level, message) => _ = transport.SendAsync(new { type = "log", level, message });

        Console.WriteLine($"[ble-host] start pipe={pipeName}");
        try
        {
            await transport.RunAsync();
        }
        finally
        {
            await host.DisposeAsync();
            await transport.DisposeAsync();
        }
        return 0;
    }

    private static string? GetArg(string[] args, string name)
    {
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (string.Equals(args[i], name, StringComparison.OrdinalIgnoreCase))
            {
                return args[i + 1];
            }
        }
        return null;
    }

    private static async Task HandleMessageAsync(GattServerHost host, PipeTransport transport, JsonElement message)
    {
        if (!message.TryGetProperty("type", out var typeEl)) return;
        var type = typeEl.GetString();
        switch (type)
        {
            case "start":
            {
                if (!await host.EnsureStartedAsync())
                {
                    await transport.SendAsync(new { type = "error", message = host.LastError });
                    return;
                }
                host.StartAdvertising();
                break;
            }
            case "stop":
                host.StopAdvertising(sendDisconnect: true);
                break;
            case "status":
                await transport.SendAsync(new { type = "status", state = host.CurrentState });
                break;
            case "data":
                await HandleDataAsync(host, message);
                break;
        }
    }

    private static async Task HandleDataAsync(GattServerHost host, JsonElement message)
    {
        if (!message.TryGetProperty("char", out var charEl) || !message.TryGetProperty("value", out var valueEl))
        {
            return;
        }
        var name = charEl.GetString();
        string? base64;
        try
        {
            base64 = valueEl.GetString();
        }
        catch
        {
            return;
        }
        if (name == null || base64 == null) return;

        byte[] value;
        try
        {
            value = Convert.FromBase64String(base64);
        }
        catch (FormatException)
        {
            return;
        }

        var guid = name switch
        {
            "mode" => GattServerHost.ModeUuid,
            "emotion" => GattServerHost.EmotionUuid,
            "tasks" => GattServerHost.TasksUuid,
            "voice" => GattServerHost.VoiceUuid,
            "heartbeat" => GattServerHost.HeartbeatUuid,
            "apikey" => GattServerHost.ApiKeyUuid,
            "ui-lang" => GattServerHost.UiLangUuid,
            _ => Guid.Empty
        };
        if (guid != Guid.Empty)
        {
            await host.UpdateValueAsync(guid, value);
        }
    }
}
