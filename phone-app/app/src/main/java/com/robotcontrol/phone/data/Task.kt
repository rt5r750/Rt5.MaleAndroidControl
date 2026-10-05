package com.robotcontrol.phone.data

data class Task(
    val id: String,
    val name: String,
    val status: String = "pending",
    val type: String? = null
) {
    val isDone: Boolean get() = status == "done"
    
    val typePriority: Int get() = when (type) {
        "cognitive" -> 0
        "terminal" -> 1
        "button" -> 3
        else -> 2
    }
}
