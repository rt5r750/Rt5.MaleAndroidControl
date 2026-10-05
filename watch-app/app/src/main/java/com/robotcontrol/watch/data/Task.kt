package com.robotcontrol.watch.data

data class Task(
    val id: String,
    val name: String,
    val status: String = "pending"
) {
    val isDone: Boolean get() = status == "done"
}
