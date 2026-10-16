// A configuração remota guarda ícones pelo nome; aqui fica o catálogo que o app sabe desenhar.
import {
  Fuel, Wallet, Gift, Wrench, Droplets, Gauge, Coffee, ShoppingBag, Car, Plus, Utensils, Dumbbell,
  UserPlus, Target, Star, Sparkles, Zap, Ticket, Heart, Pill, Shirt, ShoppingCart, Sandwich, Wine,
  Scissors, Bike, Truck, Percent, Award, Smartphone, Leaf, Baby, PawPrint, GraduationCap, Building2,
} from "lucide-react";

export const ICONS = {
  Fuel, Wallet, Gift, Wrench, Droplets, Gauge, Coffee, ShoppingBag, Car, Plus, Utensils, Dumbbell,
  UserPlus, Target, Star, Sparkles, Zap, Ticket, Heart, Pill, Shirt, ShoppingCart, Sandwich, Wine,
  Scissors, Bike, Truck, Percent, Award, Smartphone, Leaf, Baby, PawPrint, GraduationCap, Building2,
};

export const ICON_NAMES = Object.keys(ICONS);
export const iconOf = (name) => ICONS[name] || Gift;
