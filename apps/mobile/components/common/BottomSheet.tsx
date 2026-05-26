import React, { forwardRef, useMemo, ReactNode, useCallback } from "react";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children: ReactNode;
  footer?: ReactNode; // 👈 nhận từ ngoài
  snapPoints?: (string | number)[];
  enableDynamicSizing?: boolean;
};

export type BottomSheetRef = BottomSheetModal;

export const BottomSheet = forwardRef<BottomSheetRef, Props>(
  ({ children, footer, enableDynamicSizing, snapPoints }, ref) => {
    const points = useMemo(() => snapPoints, [snapPoints]);
    const insets = useSafeAreaInsets();

    const renderBackdrop = useCallback(
      (props: any) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing={enableDynamicSizing}
        snapPoints={points}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
          className="px-6 pt-6"
        >
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

BottomSheet.displayName = "BottomSheet";
