using System.IO.Pipes;
using System.Text;
using System.Text.Json;

namespace RobotControl.BleHost;

/// <summary>
/// 与 Electron 主进程的命名管道传输：JSON 行协议（每行一个 JSON 对象）。
/// 断线后自动等待重连。
/// </summary>
public sealed class PipeTransport : IAsyncDisposable
{
    private const int MaxLineLength = 8 * 1024 * 1024; // 8MB 行保护

    private readonly string _pipeName;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private NamedPipeServerStream? _server;
    private CancellationTokenSource? _cts;

    public event Func<JsonElement, Task>? OnMessage;

    public PipeTransport(string pipeName)
    {
        _pipeName = pipeName;
    }

    public async Task RunAsync()
    {
        _cts = new CancellationTokenSource();
        var ct = _cts.Token;
        while (!ct.IsCancellationRequested)
        {
            var server = new NamedPipeServerStream(
                _pipeName,
                PipeDirection.InOut,
                1,
                PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous);
            _server = server;
            try
            {
                await server.WaitForConnectionAsync(ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                try { server.Dispose(); } catch { }
                _server = null;
                await Task.Delay(300, ct);
                continue;
            }

            try
            {
                await ReadLoopAsync(server, ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch
            {
                // 连接异常，准备重连
            }
            finally
            {
                try { server.Dispose(); } catch { }
                _server = null;
            }

            if (ct.IsCancellationRequested) break;
            await Task.Delay(300, ct);
        }
    }

    private async Task ReadLoopAsync(NamedPipeServerStream server, CancellationToken ct)
    {
        var buffer = new byte[8192];
        var pending = new StringBuilder();
        while (!ct.IsCancellationRequested && server.IsConnected)
        {
            int n = await server.ReadAsync(buffer.AsMemory(0, buffer.Length), ct);
            if (n == 0) break;
            pending.Append(Encoding.UTF8.GetString(buffer, 0, n));

            if (pending.Length > MaxLineLength)
            {
                pending.Clear();
                continue;
            }

            int idx;
            while ((idx = IndexOfNewline(pending)) >= 0)
            {
                var line = pending.ToString(0, idx);
                pending.Remove(0, idx + 1);
                if (string.IsNullOrWhiteSpace(line)) continue;
                try
                {
                    using var doc = JsonDocument.Parse(line);
                    if (OnMessage != null)
                    {
                        await OnMessage(doc.RootElement.Clone());
                    }
                }
                catch (JsonException)
                {
                    // 忽略损坏行
                }
            }
        }
    }

    private static int IndexOfNewline(StringBuilder sb)
    {
        for (int i = 0; i < sb.Length; i++)
        {
            if (sb[i] == '\n') return i;
        }
        return -1;
    }

    public async Task SendAsync(object message)
    {
        var json = JsonSerializer.Serialize(message);
        await SendRawAsync(json);
    }

    private async Task SendRawAsync(string json)
    {
        var server = _server;
        if (server == null || !server.IsConnected) return;
        var bytes = Encoding.UTF8.GetBytes(json + "\n");
        await _writeLock.WaitAsync();
        try
        {
            await server.WriteAsync(bytes);
            await server.FlushAsync();
        }
        finally
        {
            _writeLock.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        try { _cts?.Cancel(); } catch { }
        try
        {
            if (_server != null)
            {
                await _server.DisposeAsync();
                _server = null;
            }
        }
        catch { }
        _writeLock.Dispose();
        _cts?.Dispose();
    }
}
