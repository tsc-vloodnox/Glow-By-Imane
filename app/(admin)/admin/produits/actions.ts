"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/admin-auth";

export async function requireAdmin() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!isAdminCookieValid(authCookie)) {
    redirect("/admin/login");
  }
}

export async function createProduct(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Number(formData.get("price") || 0);
  const stock = Number(formData.get("stock") || 0);
  const categoryId = String(formData.get("categoryId") || "").trim();
  const favorite = formData.get("favorite") === "on";
  const imagesField = String(formData.get("images") || "").trim();
  const images = imagesField
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!name || !categoryId || Number.isNaN(price) || Number.isNaN(stock)) {
    throw new Error("Informations invalides.");
  }

  await prisma.product.create({
    data: {
      name,
      description,
      price,
      stock,
      favorite,
      images,
      categoryId,
    },
  });

  revalidatePath("/admin/produits");
}

export async function updateProduct(productId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Number(formData.get("price") || 0);
  const stock = Number(formData.get("stock") || 0);
  const categoryId = String(formData.get("categoryId") || "").trim();
  const favorite = formData.get("favorite") === "on";
  const imagesField = String(formData.get("images") || "").trim();
  const images = imagesField
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!name || !categoryId || Number.isNaN(price) || Number.isNaN(stock)) {
    throw new Error("Informations invalides.");
  }

  await prisma.product.update({
    where: { id: productId },
    data: {
      name,
      description,
      price,
      stock,
      favorite,
      images,
      categoryId,
    },
  });

  revalidatePath("/admin/produits");
}

export async function deleteProduct(productId: string) {
  await requireAdmin();
  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/admin/produits");
}
