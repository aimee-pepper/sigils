# Sigil Generator Rules

## Text Processing
1. Split phrase into words
2. Remove vowels from each word
3. Deduplicate characters (preserve order of first appearance)
4. Map to numbers: a=1, b=2, ..., z=26

## Heat Map Detection
When intersections cluster in crowded zones, alternative layouts are offered.

### Configuration
- Grid: 6x6 (~33px cells for 200px canvas)
- Cell threshold: 2+ intersections = warm cell
- Zone threshold: Global score >= 4 triggers alternatives

### Analysis Process
1. Divide canvas into grid cells
2. Count intersections per cell
3. Find "warm" cells (count >= threshold)
4. Flood-fill adjacent warm cells to find connected hot zones
5. Calculate zone severity (sum of intersection counts)
6. If global score >= threshold, generate alternative layouts

### Alternative Layouts
When hot zones detected, show 4 layout options side-by-side:

1. **Standard** - Current concentric rings (default)
2. **Venn Diagram** - Two overlapping offset circles (~60% overlap)
   - First half of points on left circle
   - Second half on right circle
   - Cross-circle connections = straight lines only
3. **Extra Rings** - More rings with fewer points each
   - Reduces `pointsPerRing` to ~60% of original
   - Creates more concentric rings automatically
4. **Satellite** - Main ring + connected smaller ring
   - Main ring at center with ~70% of points
   - Smaller satellite ring offset to the side with ~30% of points
   - Highest letter values go to satellite
   - Visual connecting line between rings

### Layout Scoring
- Each layout gets a heat score (lower = better)
- Recommended layout (*) has lowest score
- User can choose any layout they prefer

## Point Placement (Standard Layout)
- Calculate rings needed: `ceil(point_count / points_per_ring)`
- Ring spacing: gap between rings = half the innermost circle's radius
- Points distributed evenly around each ring
- Fill outer ring first, then move inward

## Connection Rules
- Sort points by alphabetical value (lowest to highest)
- Connect in sorted order
- If consecutive points are adjacent on the same ring → arc follows ring curvature
- Otherwise → straight line cuts across
- **Group constraint**: Arcs only occur within the same group (for Venn/Satellite layouts, points on different circles always connect with straight lines)

## Intersection Markers
- Calculate crossing angle: 0° = parallel, 90° = perpendicular
- If crossing angle < 45° (closer to parallel) → hollow circle marker
- If crossing angle ≥ 45° (closer to perpendicular) → line break (gap in one line)
- If 2+ intersections overlap/consolidate → force hollow circle marker
- Every intersection must have a marker (either circle or line break)

## Vertex Angle Dots (Acute Angles)
- Calculate interior angle at each vertex where path changes direction
- If interior angle < 30° OR exterior angle < 30° (i.e., interior > 150°) → eligible for solid dot
- This catches both sharp points and nearly-straight-through vertices
- Only 50% of eligible vertices receive dots (seeded random selection)

## Arc Decorative Dots
- Compare arc length to the arc's outer ring circumference (2πr)
- Arc ≥ 1/4 circumference → 1 dot
- Arc ≥ 1/3 circumference → 2 dots
- Arc ≥ 1/2 circumference → 3 dots
- Maximum 3 dots per arc
- Dots spaced evenly with slight random jitter
- No overlapping dots (minimum 2 dot size diameter apart)

## Start Marker
- Hollow circle with center dot
- Placed at the point with lowest letter value

## End Marker (Bar Terminus)
- Perpendicular bar at the point with highest letter value
- Bar is perpendicular to the incoming line direction
- Bar length adjusts (can shorten OR extend) to avoid colliding with other lines
- Mark whether it collides based on the width of the terminal bar and what it hits rather than just the line end point
- Try lengths 3-20px, prefer 6-10px when possible

## Visual Parameters
- Stroke width: 2px uniform
- Background: #fafaf9
- Line color: #3f3f46
- Center dot: 2px radius at 15% opacity
- Hollow circle markers: 4px radius, 1.5px stroke
- Solid dots (acute vertices): 3px radius
- Arc decorative dots: 2px radius
- Start marker: 6px outer circle, 2px inner dot
- End bar: 3px stroke width
