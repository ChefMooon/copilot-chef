// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";

describe("AlertDialog layering", () => {
  it("uses elevated z-index classes and keeps actions clickable", () => {
    const onAction = vi.fn();

    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recipe already exists</AlertDialogTitle>
            <AlertDialogDescription>
              Duplicate recipe names are not allowed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={onAction}>Link Existing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );

    const contentNode = document.querySelector(
      'div[class*="z-[1003]"]'
    ) as HTMLDivElement | null;
    expect(contentNode).not.toBeNull();

    const overlayNode = document.querySelector(
      'div[class*="z-[1002]"]'
    ) as HTMLDivElement | null;
    expect(overlayNode).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Link Existing" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
