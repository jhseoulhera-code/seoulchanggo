import {
  Baby,
  Car,
  House,
  MonitorSmartphone,
  PawPrint,
  PenLine,
  Puzzle,
  ShoppingBag,
  Sofa,
  Utensils,
} from "lucide-react";
import type { Category } from "@/types";

export const categories: Category[] = [
  { id: "goods", label: "잡화", labelEn: "General Goods", icon: ShoppingBag },
  { id: "baby", label: "출산/유아동", labelEn: "Baby & Kids", icon: Baby },
  { id: "kitchen", label: "주방용품", labelEn: "Kitchen", icon: Utensils },
  { id: "living", label: "생활용품", labelEn: "Household", icon: House },
  { id: "interior", label: "홈인테리어", labelEn: "Home Interior", icon: Sofa },
  { id: "digital", label: "가전디지털", labelEn: "Electronics", icon: MonitorSmartphone },
  { id: "car", label: "자동차용품", labelEn: "Automotive", icon: Car },
  { id: "hobby", label: "완구/취미", labelEn: "Toys & Hobby", icon: Puzzle },
  { id: "stationery", label: "문구/오피스", labelEn: "Stationery & Office", icon: PenLine },
  { id: "pet", label: "반려동물", labelEn: "Pet Supplies", icon: PawPrint },
];
