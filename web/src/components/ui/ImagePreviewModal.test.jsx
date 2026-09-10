import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImagePreviewModal from "./ImagePreviewModal";

const images = [
  { url: "https://example.test/one.jpg", displayName: "Health_Photo_1.jpg" },
  { url: "https://example.test/two.jpg", displayName: "Health_Photo_2.jpg" },
  { url: "javascript:alert(1)", displayName: "Unsafe.jpg" },
];

const dataImage = "data:image/png;base64,iVBORw0KGgo=";

describe("ImagePreviewModal", () => {
  it("shows valid images with navigation and a counter", () => {
    const onSelectImage = vi.fn();
    render(
      <ImagePreviewModal
        images={images}
        selectedImage={images[0]}
        onSelectImage={onSelectImage}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Preview of Health_Photo_1.jpg" }),
    ).toHaveAttribute("src", images[0].url);
    expect(screen.getByText("Image 1 of 2")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close dialog" }).closest("form"),
    ).toHaveClass("bg-transparent");
    fireEvent.click(screen.getByRole("button", { name: "View next image" }));
    expect(onSelectImage).toHaveBeenCalledWith(images[1]);
    expect(screen.queryByText("Unsafe.jpg")).toBeNull();
  });

  it("keeps the image rendered after close state begins", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ImagePreviewModal
        images={images}
        selectedImage={images[0]}
        onSelectImage={vi.fn()}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <ImagePreviewModal
        images={images}
        selectedImage={null}
        onSelectImage={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByAltText("Preview of Health_Photo_1.jpg"),
    ).toBeInTheDocument();
  });

  it("supports saved base64 image evidence while rejecting unsafe data URLs", () => {
    render(
      <ImagePreviewModal
        images={[
          { url: dataImage, displayName: "AI_Evidence_1.png" },
          { url: "data:text/html;base64,PHNjcmlwdD4=", displayName: "Unsafe" },
        ]}
        selectedImage={{ url: dataImage, displayName: "AI_Evidence_1.png" }}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Preview of AI_Evidence_1.png" }),
    ).toHaveAttribute("src", dataImage);
    expect(screen.queryByText("Unsafe")).toBeNull();
  });
});
