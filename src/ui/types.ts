export type Person = {
  id: string;
  name: string;
  province: string;
  municipality: string;
  contractorProfile?: {
    bio: string;
    specialty: string;
    experienceYears: number;
    latitude: number | null;
    longitude: number | null;
  } | null;
};
export type UserProfile = Person & {
  email: string;
  phone: string;
  role: "CLIENTE" | "CONTRATISTA";
};
export type Category = { id: string; name: string; slug: string };
export type Service = {
  id: string;
  title: string;
  description: string;
  province: string;
  municipality: string;
  basePrice: string;
  visible: boolean;
  categoryId: string;
  category: Category;
  contractor: Person;
  rating?: number | null;
  reviewCount?: number;
};
export type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  author: Person;
  contractor: Person;
  request: { serviceTitle: string };
};
export type Professional = Person & {
  publications: Service[];
  receivedReviews: Review[];
  rating: number | null;
  reviewCount: number;
};
export type Payment = {
  id: string;
  requestId: string;
  amount: string;
  method: "CASH" | "CARD";
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  adapter: string;
  paidAt: string | null;
  request?: { id: string; serviceTitle: string };
};
export type Appointment = {
  id: string;
  requestId: string;
  startsAt: string;
  address: string;
  amount: string;
  status: "PROPOSED" | "CONFIRMED" | "CANCELLED";
  request?: Request;
};
export type Request = {
  id: string;
  description: string;
  address: string;
  province: string;
  municipality: string;
  serviceTitle: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  client: Person;
  contractor: Person;
  conversation: { id: string } | null;
  appointment: Appointment | null;
  payment: Payment | null;
  review: Review | null;
};
export type Message = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
};
export type Conversation = {
  id: string;
  request: Request;
  messages: Message[];
  hasMore?: boolean;
};
export type Report = {
  id: string;
  targetId: string;
  target: Person;
  reason: string;
  detail: string;
  status: string;
  createdAt: string;
};
