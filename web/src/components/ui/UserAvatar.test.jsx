import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UserAvatar from "./UserAvatar";
import AnimalAvatar from "./AnimalAvatar";

describe("semantic table avatars", () => {
  it("renders a round user image from the backend URL", () => {
    render(
      <UserAvatar
        name="Maria Santos"
        imageUrl="https://example.com/maria.jpg"
      />,
    );

    const image = screen.getByAltText("Maria Santos profile");
    expect(image).toHaveAttribute("src", "https://example.com/maria.jpg");
    expect(image).toHaveAttribute("width", "40");
    expect(image).toHaveAttribute("height", "40");
    expect(image).toHaveClass("rounded-full", "object-cover");
  });

  it("falls back to the round user placeholder when the image is absent or fails", () => {
    const { rerender } = render(<UserAvatar name="No Image Farmer" imageUrl="" />);
    expect(
      screen.getByLabelText("No Image Farmer profile image unavailable"),
    ).toHaveClass("avatar-placeholder");

    rerender(
      <UserAvatar
        name="Broken Image Farmer"
        imageUrl="https://example.com/broken.jpg"
      />,
    );
    fireEvent.error(screen.getByAltText("Broken Image Farmer profile"));
    expect(
      screen.getByLabelText("Broken Image Farmer profile image unavailable"),
    ).toHaveClass("avatar-placeholder");
  });

  it("uses the livestock image and animal-specific fallback for animal rows", () => {
    const { rerender } = render(
      <AnimalAvatar reference="ILO-601" imageUrl="https://example.com/cow.jpg" />,
    );
    expect(screen.getByAltText("ILO-601 livestock")).toHaveClass(
      "rounded-full",
      "object-cover",
    );

    rerender(<AnimalAvatar reference="ILO-602" imageUrl="" />);
    expect(screen.getByLabelText("ILO-602 image unavailable")).toHaveClass(
      "avatar-placeholder",
    );
  });
});
