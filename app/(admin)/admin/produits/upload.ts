"use server";

import { randomUUID } from "crypto";

import { createServiceClient } from "@/lib/supabase/server";

export async function uploadProductImage(file: File) {
  const bucket = "catalogue";
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const supabase = createServiceClient();

  const { error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return fileName;
}
