"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "./auth";
import { getBookings } from "./data-service";
import { supabase } from "./supabase";

export async function updateGuest(formData) {
  const session = await auth();
  if (!session) throw new Error("You mut be logged in");
  const nationalID = formData.get("nationalID");
  const [nationality, countryFlag] = formData.get("nationality").split("%");
  const regex = /^[a-zA-Z0-9]{6,12}$/;
  console.log(nationalID);

  if (regex.test(nationalID)) {
    console.log("Valid National ID");
  } else {
    throw new Error("National ID is invalid");
  }

  const updateData = { nationality, countryFlag, nationalID };
  const { data, error } = await supabase
    .from("guests")
    .update(updateData)
    .eq("id", session.user.guestId);

  if (error) {
    throw new Error("Guest could not be updated");
  }
  revalidatePath("/account/profile");
}

export async function signInAction() {
  await signIn("google", { redirectTo: "/account" });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function deleteReservation(id) {
  const session = await auth();
  if (!session) throw new Error("You mut be logged in");

  const bookings = await getBookings(session.user.guestId);
  const guestBookingIds = bookings.map((booking) => booking.id);
  if (!guestBookingIds.includes(id))
    throw new Error("You are not allowed to delete this booking");

  const { error } = await supabase.from("bookings").delete().eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Booking could not be deleted");
  }
  revalidatePath("/account/reservations");
}

export async function updateReservation(formData) {
  //Check user is allowed to update booking
  const session = await auth();
  const bookings = await getBookings(session.user.guestId);
  const guestBookingIds = bookings.map((booking) => booking.id);
  const bookingId = Number(formData.get("bookingId"));
  console.log("Booking: " + bookingId);

  const updateData = {
    numGuests: Number(formData.get("numGuests")),
    observations: formData.get("observations"),
  };
  console.log(updateData);
  if (!guestBookingIds.includes(bookingId))
    throw new Error("You are not allowed to update this booking");

  const { data, error } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId)
    .select()
    .single();

  console.log("Booking Data: " + data);

  if (error) {
    console.error(error);
    throw new Error("Booking could not be updated");
  }

  revalidatePath("/account/reservations");
  revalidatePath(`/account/reservations/edit/${bookingId}`);
  redirect("/account/reservations");
}

export async function createBooking(bookingData, formData) {
  // Authentication
  const session = await auth();
  if (!session) throw new Error("You must be logged in");

  const newBooking = {
    ...bookingData,
    guestId: session.user.guestId,
    numGuests: Number(formData.get("numGuests")),
    observations: formData.get("observations").slice(0, 1000),
    extrasPrice: 0,
    totalPrice: bookingData.cabinPrice,
    isPaid: false,
    hasBreakfast: false,
    status: "unconfirmed",
  };

  const { error } = await supabase.from("bookings").insert([newBooking]);

  if (error) {
    console.error(error);
    throw new Error("Booking could not be created");
  }

  revalidatePath(`/cabin/${bookingData.cabinId}`);
  redirect("/cabins/thankyou");
}
