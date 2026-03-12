This is the release of the multi-threaded version of Gomoku/Renju engine RAPFI22.
It contains the engine executable, config file and various NNUE weight files.

Currently, NNUE supports the following combination of rules and board sizes:
(1) Freestyle Gomoku with board size 13 to 20.
(2) Standard Gomoku with board size 15.
(3) Renju with board size 15.
For other combination of rules and board sizes, NNUE will NOT be enabled, and only classical evaluation will be used.

====Usage====
The engine can be mainly used in two ways, either in Piskvork UI or Yixin-Board GUI.
Currently, Rapfi can only run on a 64bit OS with x86-64 cpu. There are two versions of engine: AVX2 and AVX. Always choose AVX2 if your cpu has support for it, as it's much stronger than the AVX one. However, if your cpu is too old that does not have support for AVX2, use the AVX one. You can check the supported instruction sets of your cpu with a tool like CPU-Z. 

1. Piskvork: 
Select the engine executable "pbrain-rapfi_avx2.exe" or "pbrain-rapfi_avx.exe" in the engine setting panel in piskvork.

2. Yixin-Board: 
Install the latest version of Yixin GUI from Yixin's website (https://www.aiexp.info/pages/yixin.html). Then copy all the files under the "Rapfi Engine" directory, and replace the original "engine.exe" with either "pbrain-rapfi_avx2.exe" or "pbrain-rapfi_avx.exe" depending on your CPU's supported instruction sets.
Multi-threading can be enabled in the setting page of Yixin-Board. It's recommended to set thread num to the core count of your cpu. You can set the size of hash table as well (17 equals to 1GB hash size, and increase one each time will double the memory usage).
Note that Rapfi does not support time control option of "1 dan" to "9 dan", please specify the turn time and match time directly, or using the "Unlimited Time" option. Some other options in the Yixin-Board is not usable for Rapfi.


There is also a linux version of the engine under folder "linux". It runs on linux system and cpu with AVX2 support. Put the executable to the same directory of "config.toml" and weights to use it. If the problem of missing dynamic linked libraries occurs, you can use those .so files in directory "libs". You can search the web for how to set up library path.


====Contact====
If you have questions about how to use, please join the QQ group: 669067795.