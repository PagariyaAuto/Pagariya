import { Modal, ScrollView } from "../../../../../components/inputs/KeyboardAware";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { colors } from "../../../../../theme";

type IntakeStyles = Record<string, any>;

type PopupType = "success" | "error" | "warning" | "info";

type PopupState = {
  visible: boolean;
  type: PopupType;
  title: string;
  message: string;
  actionLabel?: string;
};


export function SectionCard({
  eyebrow,
  title,
  subtitle,
  children,
  styles,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  styles: IntakeStyles;
}) {
  return (
    <View
      style={styles.sectionCard}
    >
      <View
        style={
          styles.sectionHeader
        }
      >
        <View
          style={
            styles.sectionNumber
          }
        >
          <Text
            style={
              styles.sectionNumberText
            }
          >
            {eyebrow}
          </Text>
        </View>

        <View
          style={
            styles.sectionHeading
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            {title}
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            {subtitle}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.sectionBody
        }
      >
        {children}
      </View>
    </View>
  );
}

export function InfoBox({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: IntakeStyles;
}) {
  return (
    <View style={styles.infoBox}>
      <Text
        style={
          styles.infoBoxLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoBoxValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

export function FieldLabel({
  label,
  required = false,
  styles,
}: {
  label: string;
  required?: boolean;
  styles: IntakeStyles;
}) {
  return (
    <View
      style={
        styles.fieldLabelRow
      }
    >
      <Text
        style={
          styles.fieldLabel
        }
      >
        {label}
      </Text>

      {required && (
        <Text
          style={
            styles.required
          }
        >
          *
        </Text>
      )}
    </View>
  );
}

export function SegmentedTabs({
  options,
  value,
  onChange,
  styles,
}: {
  options: {
    value: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[];
  value: string;
  onChange: (
    value: string
  ) => void;
  styles: IntakeStyles;
}) {
  return (
    <View
      style={
        styles.segmentedContainer
      }
    >
      {options.map((option) => {
        const selected =
          value === option.value;

        return (
          <Pressable
            key={option.value}
            onPress={() =>
              onChange(
                option.value
              )
            }
            style={({ pressed }) => [
              styles.segment,
              selected &&
                styles.segmentSelected,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={19}
              color={
                selected
                  ? "#FFFFFF"
                  : colors.textSecondary
              }
            />

            <Text
              style={[
                styles.segmentText,
                selected &&
                  styles.segmentTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DropdownModal({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  styles,
}: {
  visible: boolean;
  title: string;
  items: {
    id: string;
    title: string;
    subtitle?: string;
  }[];
  selectedId: string;
  onSelect: (
    id: string
  ) => void;
  onClose: () => void;
  styles: IntakeStyles;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={
        onClose
      }
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View
        style={
          styles.modalOverlay
        }
      >
        <View
          style={
            styles.dropdownModalCard
          }
        >
          <View
            style={
              styles.modalHeader
            }
          >
            <View>
              <Text
                style={
                  styles.modalTitle
                }
              >
                {title}
              </Text>

              <Text
                style={
                  styles.modalSubtitle
                }
              >
                Select one option
              </Text>
            </View>

            <Pressable
              onPress={
                onClose
              }
              style={
                styles.modalCloseButton
              }
            >
              <Ionicons
                name="close"
                size={21}
                color={
                  colors.textSecondary
                }
              />
            </Pressable>
          </View>

          <ScrollView
            style={
              styles.dropdownList
            }
            showsVerticalScrollIndicator={
              false
            }
          >
            {items.length === 0 ? (
              <View
                style={
                  styles.modalEmpty
                }
              >
                <Ionicons
                  name="list-outline"
                  size={30}
                  color={
                    colors.textLight
                  }
                />

                <Text
                  style={
                    styles.modalEmptyTitle
                  }
                >
                  No options available
                </Text>
              </View>
            ) : (
              items.map(
                (item) => {
                  const selected =
                    selectedId ===
                    item.id;

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        onSelect(
                          item.id
                        )
                      }
                      style={({ pressed }) => [
                        styles.dropdownItem,
                        selected &&
                          styles.dropdownItemSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <View
                        style={
                          styles.dropdownItemText
                        }
                      >
                        <Text
                          style={[
                            styles.dropdownItemTitle,
                            selected &&
                              styles.dropdownItemTitleSelected,
                          ]}
                        >
                          {
                            item.title
                          }
                        </Text>

                        {!!item.subtitle && (
                          <Text
                            style={
                              styles.dropdownItemSubtitle
                            }
                          >
                            {
                              item.subtitle
                            }
                          </Text>
                        )}
                      </View>

                      <View
                        style={[
                          styles.radioOuter,
                          selected &&
                            styles.radioOuterSelected,
                        ]}
                      >
                        {selected && (
                          <View
                            style={
                              styles.radioInner
                            }
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                }
              )
            )}
          </ScrollView>
        </View>
      </View>
      </SafeAreaView>
    </Modal>
  );
}

export function PhotoViewerModal({
  uri,
  onClose,
  styles,
}: {
  uri: string | null;
  onClose: () => void;
  styles: IntakeStyles;
}) {
  return (
    <Modal
      visible={Boolean(uri)}
      transparent
      animationType="fade"
      onRequestClose={
        onClose
      }
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View
        style={
          styles.photoViewerOverlay
        }
      >
        <Pressable
          onPress={onClose}
          style={
            styles.photoViewerClose
          }
        >
          <Ionicons
            name="close"
            size={28}
            color="#FFFFFF"
          />
        </Pressable>

        {uri && (
          <Image
            source={{ uri }}
            style={
              styles.fullScreenPhoto
            }
            resizeMode="contain"
          />
        )}

        <Text
          style={
            styles.photoViewerHint
          }
        >
          Tap close to return
        </Text>
      </View>
      </SafeAreaView>
    </Modal>
  );
}

export function PopupModal({
  popup,
  onAction,
  styles,
}: {
  popup: PopupState;
  onAction: () => void;
  styles: IntakeStyles;
}) {
  if (!popup.visible) {
    return null;
  }

  const icon =
    popup.type === "success"
      ? "✓"
      : popup.type === "error"
        ? "!"
        : popup.type === "warning"
          ? "!"
          : "i";

  const iconBackground =
    popup.type === "success"
      ? colors.successLight
      : popup.type === "error"
        ? colors.dangerLight
        : popup.type === "warning"
          ? colors.warningLight
          : colors.infoLight;

  const iconColor =
    popup.type === "success"
      ? colors.success
      : popup.type === "error"
        ? colors.danger
        : popup.type === "warning"
          ? colors.warning
          : colors.info;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={
        onAction
      }
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "right", "bottom", "left"]}>
      <View
        style={
          styles.modalOverlay
        }
      >
        <View
          style={
            styles.popupCard
          }
        >
          <View
            style={[
              styles.popupIcon,
              {
                backgroundColor:
                  iconBackground,
              },
            ]}
          >
            <Text
              style={[
                styles.popupIconText,
                {
                  color:
                    iconColor,
                },
              ]}
            >
              {icon}
            </Text>
          </View>

          <Text
            style={
              styles.popupTitle
            }
          >
            {popup.title}
          </Text>

          <Text
            style={
              styles.popupMessage
            }
          >
            {popup.message}
          </Text>

          <Pressable
            onPress={
              onAction
            }
            style={({ pressed }) => [
              styles.popupButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.popupButtonText
              }
            >
              {popup.actionLabel ??
                "OK"}
            </Text>
          </Pressable>
        </View>
      </View>
      </SafeAreaView>
    </Modal>
  );
}

