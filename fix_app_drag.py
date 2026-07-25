import re

with open('src/App.tsx', 'r') as f:
    c = f.read()

# 1. Add state and refs for dragging
state_code = """  const notifRef = useRef<HTMLDivElement>(null);
  
  // Horizontal drag state for top menu
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingMenu, setIsDraggingMenu] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!menuScrollRef.current) return;
    setIsDraggingMenu(true);
    setStartX(e.pageX - menuScrollRef.current.offsetLeft);
    setScrollLeft(menuScrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseUp = () => {
    setIsDraggingMenu(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMenu || !menuScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - menuScrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll-fast
    menuScrollRef.current.scrollLeft = scrollLeft - walk;
  };
"""

c = c.replace("  const notifRef = useRef<HTMLDivElement>(null);", state_code)

# 2. Add classes to the div and attach handlers
# Original: <div className="flex items-center overflow-x-auto justify-center gap-2 lg:gap-8 py-3 w-full touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

# We should change justify-center to something that doesn't clip on small screens or just keep it but since we can scroll it might be fine, but wait: justify-center clips the left side if it overflows. We should use `mx-auto` or similar, or `justify-start md:justify-center`. Wait, if we use `justify-start md:justify-center` it might still clip on tablet if it overflows.
# Better: use `px-4 flex items-center overflow-x-auto gap-2 lg:gap-8 py-3 w-full touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]` and remove justify-center, or leave it. Wait, the `App.tsx` has `justify-center` currently. Let's just add the drag handlers and change to `justify-start`.
# But `justify-center` makes it look nice when it fits.
# How about `className="flex items-center overflow-x-auto gap-2 lg:gap-8 py-3 px-4 w-full touch-pan-x select-none cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"`
# Let's replace the div.

div_original = '<div className="flex items-center overflow-x-auto justify-center gap-2 lg:gap-8 py-3 w-full touch-pan-x [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">'
div_replacement = """<div 
            ref={menuScrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="flex items-center overflow-x-auto justify-start sm:justify-center gap-2 lg:gap-8 py-3 px-4 w-full touch-pan-x select-none cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >"""

c = c.replace(div_original, div_replacement)

with open('src/App.tsx', 'w') as f:
    f.write(c)

