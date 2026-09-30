import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  colors,
  radius,
  spacing,
  typography,
} from "../../../../../theme";

import { SectionCard } from "./IntakeUI";

export type IntakePhotoItem = {
  id: string;
  uri: string;
  storagePath: string | null;
  photoType: string;
};

type IntakePhotoSectionProps = {
  photos: IntakePhotoItem[];
  saving: boolean;
  onTakePhoto: () => void;
  onChooseFromGallery: () => void;
  onRemovePhoto?: (
    photo: IntakePhotoItem
  ) => Promise<void> | void;
  styles?: any;
};

export function IntakePhotoSection({
  photos,
  saving,
  onTakePhoto,
  onChooseFromGallery,
  onRemovePhoto,
  styles: parentStyles,
}: IntakePhotoSectionProps) {
  const [
    selectedPhoto,
    setSelectedPhoto,
  ] =
    useState<IntakePhotoItem | null>(
      null
    );

  const [
    photoToRemove,
    setPhotoToRemove,
  ] =
    useState<IntakePhotoItem | null>(
      null
    );

  const [
    removing,
    setRemoving,
  ] = useState(false);

  const openPhoto = (
    photo: IntakePhotoItem
  ) => {
    if (removing) {
      return;
    }

    setSelectedPhoto(photo);
  };

  const closePhoto = () => {
    if (removing) {
      return;
    }

    setSelectedPhoto(null);
  };

  const openRemoveConfirmation = (
    photo: IntakePhotoItem
  ) => {
    if (
      saving ||
      removing ||
      !onRemovePhoto
    ) {
      return;
    }

    setPhotoToRemove(photo);
  };

  const closeRemoveConfirmation =
    () => {
      if (removing) {
        return;
      }

      setPhotoToRemove(null);
    };

  const confirmRemovePhoto =
    async () => {
      if (
        !photoToRemove ||
        !onRemovePhoto ||
        removing
      ) {
        return;
      }

      try {
        setRemoving(true);

        await onRemovePhoto(
          photoToRemove
        );

        setPhotoToRemove(null);
        setSelectedPhoto(null);
      } catch (error) {
        /*
         * The parent handles the user-facing
         * error popup. We deliberately keep the
         * confirmation modal open only until the
         * parent operation finishes.
         */
        console.error(
          "Remove photo error:",
          error
        );
      } finally {
        setRemoving(false);
      }
    };

  return (
    <>
      <SectionCard
        eyebrow="08"
        title="Vehicle Photos"
        subtitle="Add clear photos of the vehicle to support the intake record."
        styles={parentStyles}
      >
        {/* Camera / Gallery */}
        <View
          style={localStyles.photoTabs}
        >
          <Pressable
            onPress={onTakePhoto}
            disabled={
              saving || removing
            }
            style={({
              pressed,
            }) => [
              localStyles.photoTab,
              localStyles.photoTabCamera,
              pressed &&
                localStyles.photoTabPressed,
              (saving ||
                removing) &&
                localStyles.photoTabDisabled,
            ]}
          >
            <View
              style={
                localStyles.photoTabIconCamera
              }
            >
              <Ionicons
                name="camera-outline"
                size={19}
                color={
                  colors.white
                }
              />
            </View>

            <View
              style={
                localStyles.photoTabText
              }
            >
              <Text
                style={
                  localStyles.photoTabTitle
                }
              >
                Camera
              </Text>

              <Text
                style={
                  localStyles.photoTabSubtitle
                }
              >
                Take photo
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={
              onChooseFromGallery
            }
            disabled={
              saving || removing
            }
            style={({
              pressed,
            }) => [
              localStyles.photoTab,
              localStyles.photoTabGallery,
              pressed &&
                localStyles.photoTabPressed,
              (saving ||
                removing) &&
                localStyles.photoTabDisabled,
            ]}
          >
            <View
              style={
                localStyles.photoTabIconGallery
              }
            >
              <Ionicons
                name="images-outline"
                size={19}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                localStyles.photoTabText
              }
            >
              <Text
                style={[
                  localStyles.photoTabTitle,
                  localStyles.photoTabGalleryTitle,
                ]}
              >
                Gallery
              </Text>

              <Text
                style={[
                  localStyles.photoTabSubtitle,
                  localStyles.photoTabGallerySubtitle,
                ]}
              >
                Choose photos
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Photo collection */}
        {photos.length > 0 ? (
          <View
            style={
              localStyles.photoCollection
            }
          >
            <View
              style={
                localStyles.collectionHeader
              }
            >
              <View
                style={
                  localStyles.collectionTitleRow
                }
              >
                <Text
                  style={
                    localStyles.collectionTitle
                  }
                >
                  Added Photos
                </Text>

                <Text
                  style={
                    localStyles.collectionSubtitle
                  }
                >
                  Tap photo to view • Use
                  trash icon to remove
                </Text>
              </View>

              <View
                style={
                  localStyles.countBadge
                }
              >
                <Text
                  style={
                    localStyles.countBadgeText
                  }
                >
                  {photos.length}
                </Text>
              </View>
            </View>

            <View
              style={
                localStyles.photoGrid
              }
            >
              {photos.map(
                (photo, index) => (
                  <View
                    key={photo.id}
                    style={
                      localStyles.photoThumbnailCard
                    }
                  >
                    <Pressable
                      onPress={() =>
                        openPhoto(
                          photo
                        )
                      }
                      disabled={
                        saving ||
                        removing
                      }
                      style={({
                        pressed,
                      }) => [
                        localStyles.photoImageButton,
                        pressed &&
                          localStyles.photoThumbnailPressed,
                      ]}
                    >
                      <Image
                        source={{
                          uri: photo.uri,
                        }}
                        style={
                          localStyles.photoThumbnail
                        }
                        resizeMode="cover"
                      />
                    </Pressable>

                    <View
                      style={
                        localStyles.photoNumberBadge
                      }
                    >
                      <Text
                        style={
                          localStyles.photoNumberText
                        }
                      >
                        {index + 1}
                      </Text>
                    </View>

                    <View
                      style={
                        localStyles.photoViewBadge
                      }
                      pointerEvents="none"
                    >
                      <Ionicons
                        name="expand-outline"
                        size={13}
                        color={
                          colors.white
                        }
                      />
                    </View>

                    {/* Trash button */}
                    {onRemovePhoto && (
                      <Pressable
                        onPress={() =>
                          openRemoveConfirmation(
                            photo
                          )
                        }
                        disabled={
                          saving ||
                          removing
                        }
                        hitSlop={5}
                        style={({
                          pressed,
                        }) => [
                          localStyles.photoDeleteButton,
                          pressed &&
                            localStyles.photoDeletePressed,
                          (saving ||
                            removing) &&
                            localStyles.photoDeleteDisabled,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={13}
                          color={
                            colors.white
                          }
                        />
                      </Pressable>
                    )}
                  </View>
                )
              )}
            </View>
          </View>
        ) : (
          <View
            style={
              localStyles.emptyPhotos
            }
          >
            <View
              style={
                localStyles.emptyPhotosIcon
              }
            >
              <Ionicons
                name="camera-outline"
                size={24}
                color={
                  colors.textLight
                }
              />
            </View>

            <Text
              style={
                localStyles.emptyPhotosTitle
              }
            >
              No vehicle photos yet
            </Text>

            <Text
              style={
                localStyles.emptyPhotosText
              }
            >
              Add the required vehicle
              photos using the camera
              or gallery.
            </Text>
          </View>
        )}
      </SectionCard>

      {/* Intake photo viewer */}
      <Modal
        visible={
          selectedPhoto !== null
        }
        transparent
        animationType="fade"
        onRequestClose={
          closePhoto
        }
      >
        <View
          style={
            localStyles.viewerContainer
          }
        >
          <Pressable
            onPress={closePhoto}
            disabled={removing}
            style={
              localStyles.viewerCloseButton
            }
            hitSlop={10}
          >
            <Ionicons
              name="close"
              size={25}
              color={colors.white}
            />
          </Pressable>

          {selectedPhoto && (
            <Image
              source={{
                uri: selectedPhoto.uri,
              }}
              style={
                localStyles.viewerImage
              }
              resizeMode="contain"
            />
          )}

          <View
            style={
              localStyles.viewerBottom
            }
          >
            <Text
              style={
                localStyles.viewerPhotoText
              }
            >
              {selectedPhoto
                ? `Photo ${
                    photos.findIndex(
                      (item) =>
                        item.id ===
                        selectedPhoto.id
                    ) + 1
                  } of ${
                    photos.length
                  }`
                : ""}
            </Text>

            {onRemovePhoto &&
              selectedPhoto && (
                <Pressable
                  onPress={() =>
                    openRemoveConfirmation(
                      selectedPhoto
                    )
                  }
                  disabled={
                    saving ||
                    removing
                  }
                  style={({
                    pressed,
                  }) => [
                    localStyles.removePhotoButton,
                    pressed &&
                      localStyles.removePhotoPressed,
                    (saving ||
                      removing) &&
                      localStyles.removePhotoDisabled,
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={
                      colors.white
                    }
                  />

                  <Text
                    style={
                      localStyles.removePhotoText
                    }
                  >
                    Remove Photo
                  </Text>
                </Pressable>
              )}
          </View>
        </View>
      </Modal>

      {/* Custom remove confirmation */}
      <Modal
        visible={
          photoToRemove !== null
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeRemoveConfirmation
        }
      >
        <View
          style={
            localStyles.confirmOverlay
          }
        >
          <View
            style={
              localStyles.confirmCard
            }
          >
            <View
              style={
                localStyles.confirmIcon
              }
            >
              <Ionicons
                name="trash-outline"
                size={27}
                color={
                  colors.danger
                }
              />
            </View>

            <Text
              style={
                localStyles.confirmTitle
              }
            >
              Remove Photo?
            </Text>

            <Text
              style={
                localStyles.confirmMessage
              }
            >
              This vehicle intake photo
              will be permanently
              removed from the intake
              record and photo storage.
            </Text>

            <View
              style={
                localStyles.confirmActions
              }
            >
              <Pressable
                onPress={
                  closeRemoveConfirmation
                }
                disabled={removing}
                style={({
                  pressed,
                }) => [
                  localStyles.cancelButton,
                  pressed &&
                    localStyles.confirmPressed,
                  removing &&
                    localStyles.confirmDisabled,
                ]}
              >
                <Text
                  style={
                    localStyles.cancelButtonText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={
                  confirmRemovePhoto
                }
                disabled={
                  removing
                }
                style={({
                  pressed,
                }) => [
                  localStyles.confirmRemoveButton,
                  pressed &&
                    localStyles.confirmPressed,
                  removing &&
                    localStyles.confirmDisabled,
                ]}
              >
                {removing ? (
                  <Text
                    style={
                      localStyles.confirmRemoveButtonText
                    }
                  >
                    Removing…
                  </Text>
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={17}
                      color={
                        colors.white
                      }
                    />

                    <Text
                      style={
                        localStyles.confirmRemoveButtonText
                      }
                    >
                      Remove
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const localStyles =
  StyleSheet.create({
    photoTabs: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    photoTab: {
      flex: 1,
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 13,
      paddingHorizontal:
        spacing.sm,
      paddingVertical:
        spacing.sm,
      borderWidth: 1,
    },

    photoTabCamera: {
      backgroundColor:
        colors.primary,
      borderColor:
        colors.primary,
    },

    photoTabGallery: {
      backgroundColor:
        colors.surface,
      borderColor:
        colors.border,
    },

    photoTabPressed: {
      opacity: 0.78,
      transform: [
        {
          scale: 0.985,
        },
      ],
    },

    photoTabDisabled: {
      opacity: 0.55,
    },

    photoTabIconCamera: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor:
        "rgba(255,255,255,0.16)",
      alignItems: "center",
      justifyContent:
        "center",
      marginRight: 8,
    },

    photoTabIconGallery: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor:
        colors.primaryLight,
      alignItems: "center",
      justifyContent:
        "center",
      marginRight: 8,
    },

    photoTabText: {
      flex: 1,
    },

    photoTabTitle: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.white,
    },

    photoTabGalleryTitle: {
      color: colors.text,
    },

    photoTabSubtitle: {
      fontSize: 10,
      color: "rgba(255,255,255,0.78)",
      marginTop: 2,
    },

    photoTabGallerySubtitle: {
      color:
        colors.textSecondary,
    },

    photoCollection: {
      marginTop: spacing.sm,
    },

    collectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom:
        spacing.sm,
    },

    collectionTitleRow: {
      flex: 1,
    },

    collectionTitle: {
      ...typography.bodyMedium,
      color: colors.text,
    },

    collectionSubtitle: {
      ...typography.caption,
      color:
        colors.textLight,
      marginTop: 1,
    },

    countBadge: {
      minWidth: 27,
      height: 27,
      paddingHorizontal: 8,
      borderRadius:
        radius.round,
      backgroundColor:
        colors.primaryLight,
      alignItems: "center",
      justifyContent:
        "center",
    },

    countBadgeText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
    },

    photoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },

    photoThumbnailCard: {
      width: 72,
      height: 72,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor:
        colors.background,
      borderWidth: 1,
      borderColor:
        colors.border,
      position: "relative",
    },

    photoImageButton: {
      width: "100%",
      height: "100%",
    },

    photoThumbnailPressed: {
      opacity: 0.75,
      transform: [
        {
          scale: 0.96,
        },
      ],
    },

    photoThumbnail: {
      width: "100%",
      height: "100%",
    },

    photoNumberBadge: {
      position: "absolute",
      top: 5,
      left: 5,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      borderRadius: 7,
      backgroundColor:
        "rgba(0,0,0,0.68)",
      alignItems: "center",
      justifyContent:
        "center",
      pointerEvents: "none",
    },

    photoNumberText: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.white,
    },

    photoViewBadge: {
      position: "absolute",
      right: 5,
      bottom: 5,
      width: 20,
      height: 20,
      borderRadius: 6,
      backgroundColor:
        "rgba(0,0,0,0.68)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    photoDeleteButton: {
      position: "absolute",
      top: 5,
      right: 5,
      width: 25,
      height: 25,
      borderRadius: 8,
      backgroundColor:
        colors.danger,
      alignItems: "center",
      justifyContent:
        "center",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.35)",
      elevation: 3,
    },

    photoDeletePressed: {
      opacity: 0.78,
      transform: [
        {
          scale: 0.92,
        },
      ],
    },

    photoDeleteDisabled: {
      opacity: 0.5,
    },

    emptyPhotos: {
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.background,
      borderRadius: 13,
      paddingHorizontal:
        spacing.lg,
      paddingVertical:
        spacing.lg,
      marginTop: spacing.xs,
    },

    emptyPhotosIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom:
        spacing.sm,
    },

    emptyPhotosTitle: {
      ...typography.bodyMedium,
      color: colors.text,
    },

    emptyPhotosText: {
      ...typography.caption,
      color:
        colors.textSecondary,
      textAlign: "center",
      lineHeight: 18,
      marginTop: 3,
    },

    viewerContainer: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.97)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    viewerImage: {
      width: "100%",
      height: "78%",
    },

    viewerCloseButton: {
      position: "absolute",
      zIndex: 20,
      top: 45,
      right: 18,
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        "rgba(255,255,255,0.14)",
      borderWidth: 1,
      borderColor:
        "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    viewerBottom: {
      position: "absolute",
      left: 18,
      right: 18,
      bottom: 28,
      alignItems: "center",
    },

    viewerPhotoText: {
      fontSize: 12,
      fontWeight: "600",
      color:
        "rgba(255,255,255,0.7)",
      marginBottom: 12,
    },

    removePhotoButton: {
      minHeight: 46,
      borderRadius: 13,
      backgroundColor:
        colors.danger,
      paddingHorizontal:
        spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 8,
    },

    removePhotoPressed: {
      opacity: 0.8,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    removePhotoDisabled: {
      opacity: 0.55,
    },

    removePhotoText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.white,
    },

    /* Confirmation modal */

    confirmOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent:
        "center",
      padding: spacing.lg,
    },

    confirmCard: {
      width: "100%",
      maxWidth: 430,
      backgroundColor:
        colors.surface,
      borderRadius: 22,
      padding: spacing.xl,
      alignItems: "center",
      shadowColor:
        "#000000",
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 10,
    },

    confirmIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor:
        colors.dangerLight,
      alignItems: "center",
      justifyContent:
        "center",
      marginBottom:
        spacing.md,
    },

    confirmTitle: {
      ...typography.subheading,
      color: colors.text,
      textAlign: "center",
      marginBottom:
        spacing.sm,
    },

    confirmMessage: {
      ...typography.body,
      color:
        colors.textSecondary,
      textAlign: "center",
      lineHeight: 21,
      marginBottom:
        spacing.lg,
    },

    confirmActions: {
      width: "100%",
      flexDirection: "row",
      gap: spacing.sm,
    },

    cancelButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor:
        colors.background,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal:
        spacing.md,
    },

    cancelButtonText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },

    confirmRemoveButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor:
        colors.danger,
      alignItems: "center",
      justifyContent:
        "center",
      flexDirection: "row",
      gap: 7,
      paddingHorizontal:
        spacing.md,
    },

    confirmRemoveButtonText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.white,
    },

    confirmPressed: {
      opacity: 0.8,
      transform: [
        {
          scale: 0.98,
        },
      ],
    },

    confirmDisabled: {
      opacity: 0.55,
    },
  });