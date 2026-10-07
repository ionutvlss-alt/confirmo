import type React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": React.HTMLAttributes<HTMLElement>;
    }
  }
}

export {};
