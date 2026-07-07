# Workspace Customizations

These rules apply to any coding task executed on the **Subnational Fiscal Dashboard** workspace:

## Visual Chart Guidelines

- **Synchronized Scales in Facet Plots:** When rendering state-wise Trellis or Facet chart grids (e.g. line plots comparing the 8 states over time):
  - Always enforce identical, synchronized Y-axis scale ranges (`min` and `max` constraints) across all state panels.
  - Do NOT let the charts auto-scale independently.
  - This ensures slopes and height scales represent correct relative proportions of metrics between states.
- **Strictly Positive Axis Scaling:** Set Y-axis to start at `0%` or use strictly positive boundaries to avoid drawing misleading negative scales.
