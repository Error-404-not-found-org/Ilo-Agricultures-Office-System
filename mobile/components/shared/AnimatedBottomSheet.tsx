import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AnimatedBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  backgroundColor: string;
  children: React.ReactNode;
  includeSafeArea?: boolean;
  maxHeight?: number;
}

export function AnimatedBottomSheet({
  visible,
  onClose,
  backgroundColor,
  children,
  includeSafeArea = true,
  maxHeight,
}: AnimatedBottomSheetProps) {
  const [showModal, setShowModal] = useState(visible);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      slideAnim.setValue(height);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowModal(false);
      });
    }
  }, [visible, fadeAnim, slideAnim, height]);

  useEffect(() => {
    if (visible && !showModal) {
      setShowModal(true);
    }
  }, [visible]);

  if (!showModal && !visible) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: fadeAnim,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetSurface,
                {
                  backgroundColor,
                  paddingBottom: includeSafeArea ? insets.bottom : 0,
                  maxHeight: maxHeight,
                },
              ]}
            >
              {children}
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetSurface: {
    width: "100%",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
});
