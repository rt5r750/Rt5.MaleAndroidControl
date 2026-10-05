# Keep the application class and entry points
-keep public class com.robotcontrol.watch.RobotWatchApplication { public *; }
-keep public class com.robotcontrol.watch.MainActivity { public *; }
-keepclassmembers class com.robotcontrol.watch.MainActivity { *; }

# Keep Kotlin data classes used for UI state
-keep class com.robotcontrol.watch.data.** { *; }
-keepclassmembers class com.robotcontrol.watch.data.** { *; }

# Keep generic signatures of View and ViewGroup subclasses used via reflection/layout inflation
-keep public class com.robotcontrol.watch.ui.** extends android.view.View { public <init>(...); }
-keep public class com.robotcontrol.watch.ui.** extends android.view.ViewGroup { public <init>(...); }

# Keep enums
-keepclassmembers enum com.robotcontrol.watch.data.Mode { *; }
