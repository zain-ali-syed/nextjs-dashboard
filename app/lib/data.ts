import { sql } from "@vercel/postgres";
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
} from "./definitions";
import { formatCurrency } from "./utils";
import { supabase } from "../db/supabase";

export async function fetchCardDataSupa() {
  try {
    console.log("Fetching  data...");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 1) Total invoices
    const invoiceCountPromise = supabase
      .from("invoices")
      .select("*", { count: "exact", head: true });

    // 2) Total customers
    const customerCountPromise = supabase
      .from("customers")
      .select("*", { count: "exact", head: true });

    // 3) All “paid” invoices (to sum their amounts)
    const paidInvoicePromise = supabase
      .from("invoices")
      .select("amount")
      .eq("status", "paid");

    // 4) All “pending” invoices (to sum their amounts)
    const pendingInvoicePromise = supabase
      .from("invoices")
      .select("amount")
      .eq("status", "pending");

    // Run all queries in parallel
    const [
      { count: invoiceCount, error: invoiceCountError },
      { count: customerCount, error: customerCountError },
      { data: paidData, error: paidDataError },
      { data: pendingData, error: pendingDataError },
    ] = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      paidInvoicePromise,
      pendingInvoicePromise,
    ]);

    // If any query returned an error, handle it
    if (
      invoiceCountError ||
      customerCountError ||
      paidDataError ||
      pendingDataError
    ) {
      throw new Error(
        invoiceCountError?.message ??
          customerCountError?.message ??
          paidDataError?.message ??
          pendingDataError?.message ??
          "Unknown error"
      );
    }

    // Safely sum amounts from each array
    const totalPaidInvoices = formatCurrency(
      paidData?.reduce((sum, invoice) => sum + invoice.amount, 0) ?? 0
    );
    const totalPendingInvoices = formatCurrency(
      pendingData?.reduce((sum, invoice) => sum + invoice.amount, 0) ?? 0
    );

    console.log("Card Data recieved..");

    return {
      numberOfInvoices: invoiceCount ?? 0,
      numberOfCustomers: customerCount ?? 0,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}
export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue>`SELECT * FROM revenue`;

    // console.log('Data fetch completed after 3 seconds.');

    return data.rows;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw>`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? "0");
    const numberOfCustomers = Number(data[1].rows[0].count ?? "0");
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? "0");
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? "0");

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const { data, error } = await supabase.from("invoices").select(
      `
        id,
        amount,
        date,
        status
      `
    );

    if (error) {
      console.error("Supabase Error:", error);
      throw new Error("Failed to fetch invoices.");
    }

    console.log(data);
    return data;
  } catch (error) {
    console.error("Unexpected Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

// export async function fetchInvoicesPages(query: string) {
//   try {
//     const count = await sql`SELECT COUNT(*)
//     FROM invoices
//     JOIN customers ON invoices.customer_id = customers.id
//     WHERE
//       customers.name ILIKE ${`%${query}%`} OR
//       customers.email ILIKE ${`%${query}%`} OR
//       invoices.amount::text ILIKE ${`%${query}%`} OR
//       invoices.date::text ILIKE ${`%${query}%`} OR
//       invoices.status ILIKE ${`%${query}%`}
//   `;

//     const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
//     return totalPages;
//   } catch (error) {
//     console.error("Database Error:", error);
//     throw new Error("Failed to fetch total number of invoices.");
//   }
// }

export async function fetchInvoicesPages(query: string) {
  const { data, count, error } = await supabase.from("invoices").select(
    `
        id,
        amount,
        date,
        status
      `,
    { count: "exact" } // This includes the total row count in the response
  );

  if (error) {
    console.error("Supabase Error:", error);
    throw new Error("Failed to fetch invoices.");
  }

  console.log("Data:", data); // Selected rows
  console.log("Total Count:", count); // Total number of records
  const totalPages = Math.ceil(Number(count! / ITEMS_PER_PAGE));
  console.log("total paegs ", totalPages);
  return totalPages;
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoice.");
  }
}

export async function fetchCustomers() {
  try {
    const { data, count, error } = await supabase.from("customers").select(
      `
          id,
          name,
          email,
          image_url
        `
    );

    console.log("Customers");
    console.log(data);
    return data;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
