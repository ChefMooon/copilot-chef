import * as React from "react";
import type { Icon as PhosphorIconComponent, IconProps } from "@phosphor-icons/react";

export type VisualIconComponent = PhosphorIconComponent;

export interface VisualIconProps extends IconProps {
  icon: VisualIconComponent;
}

export const VisualIcon = React.forwardRef<SVGSVGElement, VisualIconProps>(
  ({ icon: IconComponent, color = "currentColor", size = 18, weight = "regular", ...props }, ref) => (
    <IconComponent
      color={color}
      ref={ref}
      size={size}
      weight={weight}
      {...props}
    />
  )
);

VisualIcon.displayName = "VisualIcon";