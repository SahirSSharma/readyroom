export type Reservation = {
  id: string;
  itemId: string;
  itemName: string;
  pickupCode: string;
  pickupDay: string;
  status: "held" | "collected" | "released";
  createdAt: string;
  expiresAt: string;
};

export type Garment = {
  id: string;
  name: string;
  color: string;
  size: string;
  category: "outer";
  image: string;
  description: string;
  condition: string;
  measurements: { chest: number; length: number; sleeve: number };
  status: "available" | "held" | "collected";
  reservationId?: string;
};

// These are illustrative demonstration garments, not a real closet's inventory.
export const CATALOG: readonly Omit<Garment, "status" | "reservationId">[] = [
  {
    id: "navy", name: "The everyday navy", color: "Navy", size: "M",
    category: "outer", image: "/assets/garment-navy.png",
    description: "A single-breasted blazer with a clean two-button front and a relaxed shoulder.",
    condition: "Sample condition: gently worn; no visible damage.",
    measurements: { chest: 104, length: 72, sleeve: 61 },
  },
  {
    id: "charcoal", name: "The charcoal classic", color: "Charcoal", size: "L",
    category: "outer", image: "/assets/garment-charcoal.png",
    description: "A versatile charcoal jacket with notch lapels and a straight, easy silhouette.",
    condition: "Sample condition: gently worn; light wear at the cuffs.",
    measurements: { chest: 112, length: 75, sleeve: 63 },
  },
  {
    id: "sand", name: "The warm neutral", color: "Sand", size: "S",
    category: "outer", image: "/assets/garment-sand.png",
    description: "A soft sand blazer with simple lines, designed to pair with light or dark basics.",
    condition: "Sample condition: like new; no visible damage.",
    measurements: { chest: 96, length: 69, sleeve: 59 },
  },
  {
    id: "olive", name: "The quiet olive", color: "Olive", size: "M",
    category: "outer", image: "/assets/garment-olive.png",
    description: "An unstructured olive jacket with a softer shoulder and understated finish.",
    condition: "Sample condition: gently worn; a small lining repair.",
    measurements: { chest: 106, length: 73, sleeve: 61 },
  },
  {
    id: "plaid", name: "The subtle check", color: "Brown check", size: "L",
    category: "outer", image: "/assets/garment-plaid.png",
    description: "A muted checked blazer that adds a little texture to a simple interview outfit.",
    condition: "Sample condition: gently worn; no visible damage.",
    measurements: { chest: 110, length: 74, sleeve: 62 },
  },
  {
    id: "black", name: "The black staple", color: "Black", size: "XL",
    category: "outer", image: "/assets/garment-black.png",
    description: "A black two-button blazer with clean lapels and a generous straight cut.",
    condition: "Sample condition: gently worn; light fabric shine at elbows.",
    measurements: { chest: 120, length: 77, sleeve: 65 },
  },
];

export function findGarment(id: string) {
  return CATALOG.find((item) => item.id === id);
}
