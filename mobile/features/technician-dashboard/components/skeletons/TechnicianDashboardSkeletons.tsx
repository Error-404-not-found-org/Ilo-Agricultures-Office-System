import React from "react";
import { View } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { TECHNICIAN_DASHBOARD_CARD_CLASSNAME } from "../dashboardCardStyles";

export function TechnicianRequestSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
          style={{
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
          }}
        >
          <Skeleton shape="circle" height={52} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Skeleton width="45%" height={15} />
            <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
          </View>
          <Skeleton width={80} height={32} radius={12} />
        </View>
      ))}
    </View>
  );
}

export function TechnicianRouteSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          className={TECHNICIAN_DASHBOARD_CARD_CLASSNAME}
          style={{
            marginBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
          }}
        >
          <View style={{ width: 75, paddingRight: 10, marginRight: 15 }}>
            <Skeleton width={42} height={10} />
            <Skeleton width={58} height={13} style={{ marginTop: 8 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Skeleton width="52%" height={16} />
            <Skeleton width="76%" height={12} style={{ marginTop: 8 }} />
          </View>
          <Skeleton width={54} height={24} radius={12} />
        </View>
      ))}
    </View>
  );
}
