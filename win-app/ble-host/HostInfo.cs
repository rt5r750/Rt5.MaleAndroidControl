namespace RobotControl.BleHost;

/// <summary>宿主就绪信息（上行 ready 消息）。</summary>
public sealed class HostInfo
{
    public bool Supported { get; init; }
    public string Mac { get; init; } = "";
    public string Name { get; init; } = GattServerHost.DeviceName;
    public string? Error { get; init; }
}
