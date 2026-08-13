import { ActivityIndicator, Image, Text, View } from "react-native";

interface AppStartupScreenProps {
  isSignedIn: boolean;
}

export function AppStartupScreen({ isSignedIn }: AppStartupScreenProps) {
  const splashBg = "#ffffff";
  const accentText = "#00643B";
  const brandNameColor = "#004D2E";
  const subtextColor = "#64748b";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: splashBg,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      {/* Layered Decorative Background Glows */}
      <View
        style={{
          position: "absolute",
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: "rgba(0, 100, 59, 0.02)",
          top: "15%",
          left: -50,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: 200,
          backgroundColor: "rgba(0, 100, 59, 0.02)",
          bottom: "10%",
          right: -100,
        }}
      />

      {/* Content Container */}
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        {/* Logo Frame */}
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 5,
            marginBottom: 28,
            borderWidth: 1,
            borderColor: "#f1f5f9",
          }}
        >
          <Image
            source={require("../../../assets/logo.png")}
            style={{ width: 110, height: 110, borderRadius: 55 }}
            resizeMode="contain"
          />
        </View>

        {/* Typography */}
        <Text
          style={{
            color: brandNameColor,
            fontFamily: "Outfit_900Black",
            fontSize: 34,
            letterSpacing: 0.5,
            marginBottom: 4,
          }}
        >
          BreedSmart
        </Text>

        <Text
          style={{
            color: accentText,
            fontFamily: "Outfit_600SemiBold",
            fontSize: 12,
            letterSpacing: 2.5,
            textTransform: "uppercase",
            marginBottom: 40,
            opacity: 0.9,
          }}
        >
          Livestock Management
        </Text>

        {/* Loader */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#f8fafc",
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 30,
            borderWidth: 1,
            borderColor: "#e2e8f0",
            gap: 12,
          }}
        >
          <ActivityIndicator size="small" color="#00643B" />
          <Text
            style={{
              color: brandNameColor,
              fontFamily: "Outfit_700Bold",
              fontSize: 10,
              letterSpacing: 1.5,
              opacity: 0.85,
            }}
          >
            {isSignedIn
              ? "RESOLVING PERMISSIONS..."
              : "AUTHENTICATING..."}
          </Text>
        </View>
      </View>

      {/* Footer Brand Info */}
      <View
        style={{
          position: "absolute",
          bottom: 40,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: subtextColor,
            fontFamily: "Outfit_500Medium",
            fontSize: 11,
            letterSpacing: 1,
            opacity: 0.6,
          }}
        >
          © 2026 BreedSmart Initiative
        </Text>
      </View>
    </View>
  );
}
