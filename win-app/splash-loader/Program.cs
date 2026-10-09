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

            // 目录可写前置检查：运行时数据（huancun）与 Chromium 的 userData/临时目录都要写在
            // 安装目录下；解压到 Program Files 等受限位置时 Electron 会在建目录阶段直接退出，
            // 表现为「双击没反应」。这里提前给出可操作的提示，而不是静默失败。
            if (!IsWritable(exeDir))
            {
                var answer = MessageBox.Show(
                    string.Format(
                        "当前目录不可写：\n{0}\n\n运行时数据需要写在程序目录下的 huancun 文件夹。\n" +
                        "请把压缩包解压到「文档」「桌面」或其他可写目录后重新运行。\n\n" +
                        "是否仍要尝试启动？（可能失败）",
                        exeDir),
                    "目录不可写",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);
                if (answer != DialogResult.Yes) return;
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

        // 只判断「能否在本目录写入文件」，不解析任何外部传入的路径。
        private static bool IsWritable(string dir)
        {
            string probe = Path.Combine(dir, ".write-probe");
            try
            {
                using (var fs = new FileStream(probe, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    fs.WriteByte(0);
                }
                File.Delete(probe);
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
