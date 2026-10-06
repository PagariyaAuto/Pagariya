import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../lib/supabase";
import { colors, spacing } from "../../theme";

type WorkspaceState = "loading" | "error" | "unavailable";

const PROFILE_TIMEOUT = 10000;

function withTimeout<T>(
  promise: PromiseLike<T>,
  milliseconds: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("The request took too long to complete."));
      }
    }, milliseconds);

    Promise.resolve(promise).then(
      (value) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export default function WorkScreen() {
  const [state, setState] = useState<WorkspaceState>("loading");

  const [message, setMessage] = useState("Loading your work...");

  const [retrying, setRetrying] = useState(false);

  const requestIdRef = useRef(0);

  const routeToRoleWork = useCallback(async (manualRetry = false) => {
    const requestId = ++requestIdRef.current;

    if (manualRetry) {
      setRetrying(true);
    }

    setState("loading");
    setMessage("Loading your work...");

    try {
      /*
       * ---------------------------------------------------
       * STEP 1
       * Get the current Supabase session.
       *
       * getSession() reads the locally stored session and
       * is normally faster/more reliable for initial routing
       * than waiting for a network user lookup.
       * ---------------------------------------------------
       */

      let sessionResult;

      try {
        sessionResult = await withTimeout(
          supabase.auth.getSession(),
          PROFILE_TIMEOUT,
        );
      } catch (sessionError) {
        console.log("Work session check failed:", sessionError);

        /*
         * One fallback attempt through getUser().
         * This helps if the local session needs refreshing.
         */
        const userResult = await withTimeout(
          supabase.auth.getUser(),
          PROFILE_TIMEOUT,
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (userResult.error || !userResult.data.user) {
          router.replace("/login");
          return;
        }

        sessionResult = {
          data: {
            session: {
              user: userResult.data.user,
            },
          },
          error: null,
        };
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      const session = sessionResult.data.session;

      /*
       * ---------------------------------------------------
       * STEP 2
       * No active session.
       * ---------------------------------------------------
       */

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const userId = session.user.id;

      /*
       * ---------------------------------------------------
       * STEP 3
       * Load the user's profile and role.
       * ---------------------------------------------------
       */

      const profileResult = await withTimeout(
        supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", userId)
          .maybeSingle(),
        PROFILE_TIMEOUT,
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      const { data: profile, error: profileError } = profileResult;

      /*
       * ---------------------------------------------------
       * STEP 4
       * Profile could not be loaded.
       * ---------------------------------------------------
       */

      if (profileError) {
        console.log("Work profile error:", profileError);

        setState("error");
        setMessage("Could not load your profile. Please try again.");
        return;
      }

      if (!profile) {
        setState("error");
        setMessage(
          "Your profile could not be found. Please contact the administrator.",
        );
        return;
      }

      /*
       * ---------------------------------------------------
       * STEP 5
       * Inactive user.
       * ---------------------------------------------------
       */

      if (!profile.is_active) {
        await supabase.auth.signOut();

        if (requestId !== requestIdRef.current) {
          return;
        }

        router.replace("/login");
        return;
      }

      /*
       * ---------------------------------------------------
       * STEP 6
       * Route according to role.
       * ---------------------------------------------------
       */

      switch (profile.role) {
        case "advisor":
          router.replace("/(tabs)/advisor/work");
          return;

        case "ceo_admin":
          /*
           * CEO Admin can see the Advisor Work
           * queue as agreed in the workflow.
           */
          router.replace("/(tabs)/advisor/work");
          return;

        case "floor_incharge":
          router.replace("/(tabs)/floor-incharge");
          return;

        case "supervisor":
          setState("unavailable");
          setMessage("The Supervisor workspace is not available yet.");
          return;

        case "worker_group":
          setState("unavailable");
          setMessage("The Worker Group workspace is not available yet.");
          return;

        case "billing_department":
          setState("unavailable");
          setMessage("The Billing workspace is not available yet.");
          return;

        case "watchman":
          setState("unavailable");
          setMessage("The Watchman workspace is not available here.");
          return;

        default:
          setState("unavailable");
          setMessage("No workspace is available for your current role.");
          return;
      }
    } catch (error) {
      console.log("Work role routing error:", error);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setState("error");
      setMessage("Something went wrong while loading your work.");
    } finally {
      if (requestId === requestIdRef.current) {
        setRetrying(false);
      }
    }
  }, []);

  /*
   * -------------------------------------------------------
   * IMPORTANT:
   *
   * useFocusEffect runs whenever the Work tab becomes active.
   *
   * This fixes the problem where the old useEffect only ran
   * during the initial mount.
   * -------------------------------------------------------
   */

  useFocusEffect(
    useCallback(() => {
      let active = true;

      routeToRoleWork();

      return () => {
        active = false;

        /*
         * Invalidate any request that is still running.
         * This prevents an old request from changing the
         * screen after the user has already left it.
         */
        requestIdRef.current += 1;

        void active;
      };
    }, [routeToRoleWork]),
  );

  const handleRetry = () => {
    routeToRoleWork(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        <View style={styles.content}>
          {/* ------------------------------------------------
              BRAND HEADER
             ------------------------------------------------ */}

          <View style={styles.brandCard}>
            <View style={styles.brandIcon}>
              <Ionicons name="briefcase-outline" size={25} color="#FFFFFF" />
            </View>

            <View style={styles.brandTextBlock}>
              <Text style={styles.brandEyebrow}>PAGARIYA WORKSPACE</Text>

              <Text style={styles.brandTitle}>Work</Text>

              <Text style={styles.brandSubtitle}>
                Your role-based operational workspace
              </Text>
            </View>
          </View>

          {/* ------------------------------------------------
              LOADING
             ------------------------------------------------ */}

          {state === "loading" && (
            <View style={styles.statusCard}>
              <View style={styles.loadingIcon}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>

              <Text style={styles.statusTitle}>Loading your work...</Text>

              <Text style={styles.statusMessage}>
                Checking your account and opening the correct workspace.
              </Text>
            </View>
          )}

          {/* ------------------------------------------------
              ERROR
             ------------------------------------------------ */}

          {state === "error" && (
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, styles.errorIcon]}>
                <Ionicons
                  name="alert-circle-outline"
                  size={29}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.statusTitle}>Workspace Unavailable</Text>

              <Text style={styles.statusMessage}>{message}</Text>

              <Pressable
                onPress={handleRetry}
                disabled={retrying}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                  retrying && styles.retryButtonDisabled,
                ]}
              >
                {retrying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                )}

                <Text style={styles.retryButtonText}>
                  {retrying ? "Refreshing..." : "Refresh Workspace"}
                </Text>
              </Pressable>
            </View>
          )}

          {/* ------------------------------------------------
              UNAVAILABLE ROLE
             ------------------------------------------------ */}

          {state === "unavailable" && (
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, styles.unavailableIcon]}>
                <Ionicons
                  name="construct-outline"
                  size={29}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.statusTitle}>Workspace Unavailable</Text>

              <Text style={styles.statusMessage}>{message}</Text>

              <Pressable
                onPress={handleRetry}
                disabled={retrying}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.retryButtonPressed,
                  retrying && styles.retryButtonDisabled,
                ]}
              >
                {retrying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                )}

                <Text style={styles.retryButtonText}>
                  {retrying ? "Refreshing..." : "Refresh Workspace"}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    justifyContent: "flex-start",
  },

  /* =========================================
     BRAND CARD
     ========================================= */

  brandCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },

  brandIcon: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  brandTextBlock: {
    flex: 1,
  },

  brandEyebrow: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 3,
  },

  brandTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 29,
    fontWeight: "900",
  },

  brandSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },

  /* =========================================
     STATUS CARD
     ========================================= */

  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 35,
    alignItems: "center",
  },

  loadingIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  statusIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  errorIcon: {
    backgroundColor: "#FCE4E4",
  },

  unavailableIcon: {
    backgroundColor: colors.primaryLight,
  },

  statusTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  statusMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 390,
  },

  /* =========================================
     RETRY
     ========================================= */

  retryButton: {
    marginTop: 22,
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  retryButtonPressed: {
    opacity: 0.85,
  },

  retryButtonDisabled: {
    opacity: 0.7,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
