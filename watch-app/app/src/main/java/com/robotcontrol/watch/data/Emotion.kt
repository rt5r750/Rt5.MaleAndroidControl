package com.robotcontrol.watch.data

data class Emotion(
    val obedience: Int = 100,
    val shame: Int = 0,
    val pleasure: Int = 100,
    val mechanical: Int = 50
) {
    init {
        require(obedience in 0..100) { "obedience must be in 0..100" }
        require(shame in 0..100) { "shame must be in 0..100" }
        require(pleasure in 0..100) { "pleasure must be in 0..100" }
        require(mechanical in 0..100) { "mechanical must be in 0..100" }
    }
}
