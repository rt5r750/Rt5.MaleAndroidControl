using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace RobotControl.SplashLoader
{
    // 无窗口启动器：冷启动测量显示 Electron 到启动器窗口约 0.5~1.3s，
    // 前序可见加载界面已被移除。本程序仅负责拉起 runtime 主程序后立即退出。
    static class Program
    {
        [STAThread]
        static void Main()
        {
            string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? ".";
            string electronExe = Path.Combine(exeDir, "runtime", "RobotControl-Console-Main.exe");

            if (!File.Exists(electronExe))
            {
                MessageBox.Show(
                    string.Format("未找到主程序：{0}\n请检查 runtime 目录是否完整。", electronExe),
                    "启动失败",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return;
            }

            try
            {
                // 主程序固定位于本程序同目录的 runtime 子目录，文件名是编译期常量；
                // 使用 ProcessStartInfo + UseShellExecute=false，不经过 shell，无用户输入。
                using (var process = new Process())
                {
                    process.StartInfo = new ProcessStartInfo
                    {
                        FileName = electronExe,
                        WorkingDirectory = Path.GetDirectoryName(electronExe),
                        UseShellExecute = false,
                        CreateNoWindow = true
                    };
                    process.Start();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    string.Format("启动主程序失败：{0}", ex.Message),
                    "启动失败",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
    }
}
