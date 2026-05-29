export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  averageRating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  houseNumber?: string;
  street?: string;
  subdivision?: string;
  barangay: string;
  city: string;
  province: string;
  region?: string;
  zipCode?: string;
  phoneNumber?: string;
  landmark?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  isDefault?: boolean;
}

export interface User {
  _id: string;
  clerkId?: string;
  email?: string;
  name: string;
  imageUrl?: string;
  phoneNumber?: string;
  address?: Address;
  role: "admin" | "technician" | "farmer";
  isVerified?: boolean;
  status: "active" | "on-site" | "on-leave";
  pushToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  _id: string;
  user: string;
  clerkId: string;
  orderItems: OrderItem[];
  shippingAddress: {
    fullName: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    phoneNumber: string;
  };
  paymentResult: {
    id: string;
    status: string;
  };
  totalPrice: number;
  status: "pending" | "shipped" | "delivered";
  hasReviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  _id: string;
  product: Product;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Review {
  _id: string;
  productId: string;
  userId: string | User;
  orderId: string;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  _id: string;
  product: Product;
  quantity: number;
}

export interface Cart {
  _id: string;
  user: string;
  clerkId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}
