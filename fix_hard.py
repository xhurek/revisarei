import re

with open('src/components/FlashcardsRoom.tsx', 'r') as f:
    c = f.read()

replacement = """              {/* Feedback Overlay: DIFÍCIL (Hard) */}
              {gradeFeedback === 'hard' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-amber-500 flex flex-col items-center justify-center z-30 text-white rounded-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                  >
                    <Brain className="w-28 h-28 text-white stroke-[2]" />
                    <span className="text-2xl font-black tracking-widest mt-6 uppercase">DIFÍCIL</span>
                  </motion.div>
                </motion.div>
              )}"""

c = re.sub(r'              \{/\* Feedback Overlay: DIFÍCIL \(Hard\) - Cartão Rasgado na Vertical \*/\}.*?              \{/\* Feedback Overlay: BOM \(Good\) \*/\}', replacement + '\n\n              {/* Feedback Overlay: BOM (Good) */}', c, flags=re.DOTALL)

with open('src/components/FlashcardsRoom.tsx', 'w') as f:
    f.write(c)

