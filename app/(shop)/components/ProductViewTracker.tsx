"use client";

import { useEffect } from "react";
import { trackPixelEvent } from "@/lib/fbpixel";

type Props = {
  id: string;
  name: string;
  price: number;
};

export function ProductViewTracker({ id, name, price }: Props) {
  useEffect(() => {
    trackPixelEvent("ViewContent", {
      content_ids: [id],
      content_name: name,
      content_type: "product",
      value: price,
      currency: "GNF",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return null;
}