"use server";

import { z } from "zod";
import { supabase } from "../db/supabase";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Define the Zod schemas
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(), // Coerce strings to numbers
  status: z.enum(["pending", "paid"]), // Enum validation for specific values
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true }); // For creating invoices

export default async function createInvoice(formData: FormData) {
  // Convert FormData to a plain object
  const rawFormData = Object.fromEntries(formData.entries());

  console.log("Raw Form Data:", rawFormData);

  // Use safeParse to validate the data
  const result = CreateInvoice.safeParse(rawFormData);

  if (!result.success) {
    console.error("Validation Errors:", result.error.errors);

    // Return validation errors for the client
    return { success: false, errors: result.error.errors };
  }

  const date = new Date().toISOString().split("T")[0];

  //console.log({ ...result.data, date });
  // Proceed with creating the invoice
  // Example: save to the database
  // Insert validated data into the invoices table
  try {
    console.log("*****************");
    console.log({
      ...result.data, // Spread other fields
      customer_id: result.data.customerId, // Map customerId to customer_id
      date, // Ensure the date is included
    });
    const { customerId, ...rest } = result.data;
    const { data: insertedData, error } = await supabase
      .from("invoices")
      .insert([
        {
          ...rest, // Spread remaining fields except customerId
          customer_id: customerId, // Add customer_id
          date, // Include the date
        },
      ]);

    if (error) {
      console.error("Database Insertion Error:", error);
      throw new Error("Failed to insert invoice.");
    }

    console.log("Inserted Data:", insertedData);
    revalidatePath("/dashboard/invoices");
    redirect("/dashboard/invoices");
  } catch (error) {
    console.error("Unexpected Error:", error);
    throw new Error("Failed to create invoice.");
  }

  return { success: true, data: { ...result.data, date } };
}
