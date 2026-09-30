import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../../../../lib/supabase";
import type { PhotoItem } from "./intake.types";

export const VEHICLE_PHOTO_BUCKET = "vehicle-photos";

export async function loadGateInPhoto(
  currentVehicleId: string
): Promise<PhotoItem | null> {
  const { data, error } = await supabase
    .from("vehicle_photos")
    .select(
      "id, storage_path, photo_type, uploaded_at"
    )
    .eq("vehicle_id", currentVehicleId)
    .eq("photo_type", "GATE_IN")
    .order("uploaded_at", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    console.warn(
      "Gate-in photo lookup error:",
      error
    );

    return null;
  }

  const row = data?.[0];

  if (!row?.storage_path) {
    return null;
  }

  const signed =
    await supabase.storage
      .from(VEHICLE_PHOTO_BUCKET)
      .createSignedUrl(
        row.storage_path,
        60 * 60
      );

  let uri =
    !signed.error &&
    signed.data?.signedUrl
      ? signed.data.signedUrl
      : null;

  if (!uri) {
    uri =
      supabase.storage
        .from(VEHICLE_PHOTO_BUCKET)
        .getPublicUrl(
          row.storage_path
        ).data?.publicUrl ?? null;
  }

  return uri
    ? {
        id: row.id,
        uri,
        storagePath:
          row.storage_path,
        photoType:
          row.photo_type,
      }
    : null;
}

export async function loadIntakePhotos(
  currentVehicleId: string
): Promise<PhotoItem[]> {
  const { data, error } =
    await supabase
      .from("vehicle_photos")
      .select(
        "id, storage_path, photo_type, uploaded_at"
      )
      .eq(
        "vehicle_id",
        currentVehicleId
      )
      .order("uploaded_at", {
        ascending: true,
      });

  if (error) {
    console.warn(
      "Vehicle photos lookup error:",
      error
    );

    return [];
  }

  const resolved: PhotoItem[] = [];

  for (const row of (
    data ?? []
  ).filter(
    (item) =>
      item.photo_type !== "GATE_IN"
  )) {
    if (!row.storage_path) {
      continue;
    }

    const signed =
      await supabase.storage
        .from(
          VEHICLE_PHOTO_BUCKET
        )
        .createSignedUrl(
          row.storage_path,
          60 * 60
        );

    let uri =
      !signed.error &&
      signed.data?.signedUrl
        ? signed.data.signedUrl
        : null;

    if (!uri) {
      uri =
        supabase.storage
          .from(
            VEHICLE_PHOTO_BUCKET
          )
          .getPublicUrl(
            row.storage_path
          ).data?.publicUrl ?? null;
    }

    if (uri) {
      resolved.push({
        id: row.id,
        uri,
        storagePath:
          row.storage_path,
        photoType:
          row.photo_type,
      });
    }
  }

  return resolved;
}

export async function uploadLocalPhoto(
  asset: ImagePicker.ImagePickerAsset,
  currentVehicleId: string,
  userId: string
): Promise<PhotoItem> {
  const extension =
    asset.fileName
      ?.split(".")
      .pop()
      ?.toLowerCase() ||
    "jpg";

  const fileName = `intake_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;

  const storagePath = `vehicles/${currentVehicleId}/INTAKE/${fileName}`;

  const response =
    await fetch(asset.uri);

  const blob =
    await response.blob();

  const {
    error: uploadError,
  } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .upload(
      storagePath,
      blob,
      {
        contentType:
          asset.mimeType ??
          "image/jpeg",
        upsert: false,
      }
    );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: photoRow,
    error: photoInsertError,
  } = await supabase
    .from("vehicle_photos")
    .insert({
      vehicle_id:
        currentVehicleId,
      photo_type: "INTAKE",
      storage_path:
        storagePath,
      uploaded_by: userId,
    })
    .select(
      "id, storage_path, photo_type"
    )
    .single();

  if (photoInsertError) {
    await supabase.storage
      .from(VEHICLE_PHOTO_BUCKET)
      .remove([storagePath]);

    throw photoInsertError;
  }

  const signed =
    await supabase.storage
      .from(VEHICLE_PHOTO_BUCKET)
      .createSignedUrl(
        storagePath,
        60 * 60
      );

  const uri =
    !signed.error &&
    signed.data?.signedUrl
      ? signed.data.signedUrl
      : asset.uri;

  return {
    id: photoRow.id,
    uri,
    storagePath,
    photoType: "INTAKE",
  };
}

/**
 * Deletes one Vehicle Intake photo.
 *
 * IMPORTANT:
 * This function deliberately refuses to delete
 * GATE_IN photos.
 *
 * The database record is removed first and then
 * the Storage object is removed.
 */
export async function deleteIntakePhoto(
  photo: PhotoItem
): Promise<void> {
  if (!photo?.id) {
    throw new Error(
      "Photo record is unavailable."
    );
  }

  if (
    photo.photoType
      ?.trim()
      .toUpperCase() === "GATE_IN"
  ) {
    throw new Error(
      "Gate-in photos cannot be removed from Vehicle Intake."
    );
  }

  if (
    photo.photoType
      ?.trim()
      .toUpperCase() !== "INTAKE"
  ) {
    throw new Error(
      "Only Vehicle Intake photos can be removed here."
    );
  }

  /*
   * Delete the database record first.
   *
   * This prevents the application from continuing
   * to treat the photo as an active intake photo
   * if Storage deletion succeeds.
   */
  const {
    error: databaseError,
  } = await supabase
    .from("vehicle_photos")
    .delete()
    .eq("id", photo.id)
    .eq(
      "photo_type",
      "INTAKE"
    );

  if (databaseError) {
    throw databaseError;
  }

  /*
   * Storage cleanup.
   *
   * If storagePath is missing, the database
   * deletion has already succeeded, so there is
   * nothing further to remove.
   */
  if (!photo.storagePath) {
    return;
  }

  const {
    error: storageError,
  } = await supabase.storage
    .from(VEHICLE_PHOTO_BUCKET)
    .remove([
      photo.storagePath,
    ]);

  if (storageError) {
    /*
     * The DB row has already been removed.
     * Report the Storage error so the UI can tell
     * the user that the photo record was removed
     * but Storage cleanup needs attention.
     */
    throw new Error(
      `Photo record was removed, but the Storage file could not be deleted: ${storageError.message}`
    );
  }
}