# Figma Cutout Guide: Garage Hub Objects

## Goal
Cut out each interactive object from `public/images/garage-hub.png` as a separate transparent PNG. These will be overlaid on the base illustration so each object can have individual hover effects (brighten, scale, glow).

## Object List

| # | Object | Filename | Maps To |
|---|--------|----------|---------|
| 1 | TV (left wall) | `tv.png` | Live standings overlay |
| 2 | Trophy shelf (center-left wall) | `trophy-shelf.png` | `/standings` |
| 3 | Whiteboard (center wall) | `whiteboard.png` | `/races` |
| 4 | Cork board (right wall) | `corkboard.png` | `/stats` |
| 5 | Clipboard (workbench left) | `clipboard.png` | `/picks` |
| 6 | Toolbox (workbench center) | `toolbox.png` | `/rules` |
| 7 | Notebook (workbench right) | `notebook.png` | `/predictions` |
| 8 | Arcade cabinet (far right) | `arcade.png` | `/game` |
| 9 | Tire stack (decorative) | `tire-stack.png` | Future use |
| 10 | Tool cart (decorative) | `tool-cart.png` | Future use |

Save all exports to: `public/images/zones/`

## Step-by-Step Instructions

### 1. Create the file

1. Go to **figma.com/files**
2. Click **+ New** (top-right) -> **Design File**

### 2. Set up the frame

1. Press **F** (Frame tool)
2. Click and drag to create a frame
3. In the right panel under Design, set **W: 3344** and **H: 1882**
4. Press **V** to switch back to Move tool

### 3. Import the garage image

1. Drag `garage-hub.png` from Finder onto the frame
2. Select the image, set in right panel: **X: 0, Y: 0, W: 3344, H: 1882**
3. Image should perfectly fill the frame

### 4. Lock the image layer

1. In the **left panel** (Layers), find the image layer
2. Right-click -> **Lock** (prevents accidental moves)

### 5. Trace an object (repeat for each)

1. Press **P** (Pen tool)
2. Click around the outline of the object, placing points at each corner/curve
   - Straight edges: just click at each corner
   - Curves: click and **drag** to create a curve handle
   - 10-15 points per object is plenty
   - Stay slightly OUTSIDE the edge (1-2px generous)
3. Click your first point to **close the path**
4. Press **V** to go back to Move tool

### 6. Create the masked cutout

1. **Unlock** the garage image (right-click in Layers -> Unlock)
2. **Duplicate** the image: click it, press **Cmd+D** (Mac) / **Ctrl+D** (Windows)
3. Select BOTH the vector shape AND the top image copy:
   - Click vector shape in Layers
   - Hold **Shift**, click the duplicated image
4. Right-click -> **Use as Mask** (or **Cmd+Shift+M**)
5. You should see just the object isolated on transparent background
6. **Re-lock** the original image (right-click -> Lock)

### 7. Export the cutout

1. Click the **mask group** in Layers
2. Right panel -> scroll to **Export** section
3. Click **+** to add an export
4. Format: **PNG** (transparency is automatic)
5. Click **Export** -> save with the correct filename

### 8. Clean up before next object

1. **Hide** the mask group (eye icon in Layers) or move it outside the frame
2. Ensure the original locked image is visible
3. Repeat steps 5-7 for the next object

## Tips

- **Zoom in** (Cmd+scroll) when tracing for accuracy
- **Undo** with Cmd+Z if you misplace a point
- **Edit points** after closing: double-click the shape to re-enter edit mode
- **Don't stress perfection** — these sit on top of the identical base image, so a generous outline is invisible
- For the **trophy shelf**, trace around the ENTIRE shelf including trophies and model car as one shape
- For the **TV**, include the bezel/frame, not just the dark screen area
- For the **arcade cabinet**, trace the full cabinet top to bottom

## After Export

Once all PNGs are in `public/images/zones/`, Claude will:
1. Update `GarageScene.tsx` to overlay each object PNG at its exact position on top of the base image
2. Add per-object hover effects (brighten, slight scale-up, glow) that follow the actual object shape
3. Wire up the TV screen area for live standings data
4. Keep the floating label tooltips on hover
