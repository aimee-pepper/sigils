# Sigil Generator Rules

## Text Processing
1. Split phrase into words
2. Remove vowels from each word
3. Deduplicate characters (preserve order of first appearance)
4. Map to numbers: a=1, b=2, ..., z=26

## Point Placement
- Calculate rings needed: `ceil(point_count / points_per_ring)`
- Ring spacing: gap between rings = half the innermost circle's radius
- Points distributed evenly around each ring
- Fill outer ring first, then move inward

## Connection Rules
- Sort points by alphabetical value (lowest to highest)
- Connect in sorted order
- If consecutive points are adjacent on the same ring → arc follows ring curvature
- Otherwise → straight line cuts across

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
- Compare arc length to the arc's ring circumference (2πr)
- Arc ≥ 1/10 circumference (36°) → 1 dot
- Arc ≥ 1/6 circumference (60°) → 2 dots
- Arc ≥ 1/4 circumference (90°) → 3 dots
- Maximum 3 dots per arc
- Dots spaced evenly with slight random jitter
- No overlapping dots (minimum 8px apart)

## Start Marker
- Hollow circle with center dot
- Placed at the point with lowest letter value

## End Marker (Bar Terminus)
- Perpendicular bar at the point with highest letter value
- Bar is perpendicular to the incoming line direction
- Bar length adjusts (can shorten OR extend) to avoid colliding with other lines
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
