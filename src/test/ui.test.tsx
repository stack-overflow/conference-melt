import { describe, it, expect, vi, afterEach } from "vitest";
import { useRef, useState } from "react";
import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "../components/ui/Sheet";
import { Popover } from "../components/ui/Popover";
import { Chip } from "../components/ui/Chip";
import { Avatar, initials } from "../components/ui/Avatar";
import { Segmented } from "../components/ui/Segmented";
import { Slider } from "../components/ui/Slider";
import { Toggle } from "../components/ui/Toggle";
import { EmptyState } from "../components/ui/EmptyState";
import { CopySheet } from "../components/ui/CopySheet";
import { Star } from "../components/ui/Star";
import { useMediaQuery, useTier } from "../state/useMediaQuery";
import { useStore } from "../state/store";

function active(): Element | null {
  return document.activeElement;
}

function pressTab(shift = false): void {
  fireEvent.keyDown(active() ?? document.body, { key: "Tab", shiftKey: shift });
}

function SheetHarness({ side = "right" }: { side?: "left" | "right" | "bottom" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Otwórz
      </button>
      <Sheet open={open} side={side} title="Szczegóły" onClose={() => setOpen(false)}>
        <button type="button">Pierwszy</button>
        <button type="button">Drugi</button>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("renders a modal dialog named by its title and moves focus inside it", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const dialog = screen.getByRole("dialog", { name: "Szczegóły" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(active())).toBe(true);
  });

  it("traps Tab and Shift+Tab inside the panel", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const dialog = screen.getByRole("dialog", { name: "Szczegóły" });
    const close = within(dialog).getByRole("button", { name: "Zamknij" });
    const first = within(dialog).getByRole("button", { name: "Pierwszy" });
    const second = within(dialog).getByRole("button", { name: "Drugi" });
    pressTab();
    expect(active()).toBe(close);
    pressTab();
    expect(active()).toBe(first);
    pressTab();
    expect(active()).toBe(second);
    pressTab();
    expect(active()).toBe(close);
    pressTab(true);
    expect(active()).toBe(second);
  });

  it("keeps summaries in the focus order and skips the contents of a closed details", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button" onClick={() => undefined}>
          Otwórz
        </button>
        <Sheet open side="right" title="Filtry" onClose={() => undefined}>
          <details>
            <summary>Tematyka</summary>
            <input aria-label="Szukaj tematu" />
          </details>
          <button type="button">Po sekcji</button>
        </Sheet>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "Filtry" });
    const close = within(dialog).getByRole("button", { name: "Zamknij" });
    const summary = within(dialog).getByText("Tematyka");
    const after = within(dialog).getByRole("button", { name: "Po sekcji" });
    pressTab();
    expect(active()).toBe(close);
    pressTab();
    expect(active()).toBe(summary);
    pressTab();
    expect(active()).toBe(after);
    expect(active()).not.toBe(within(dialog).getByLabelText("Szukaj tematu"));
    await user.keyboard("{Escape}");
  });

  it("closes on Escape and restores focus to the opener", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    const opener = screen.getByRole("button", { name: "Otwórz" });
    await user.click(opener);
    screen.getByRole("dialog", { name: "Szczegóły" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(active()).toBe(opener);
  });

  it("closes on backdrop click and on the close button", async () => {
    const user = userEvent.setup();
    render(<SheetHarness />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const backdrop = document.querySelector("[data-sheet-backdrop]");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks the bottom variant on its root", async () => {
    const user = userEvent.setup();
    render(<SheetHarness side="bottom" />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    expect(document.querySelector('[data-side="bottom"]')).not.toBeNull();
  });

  it("renders a left-side sheet with the left class", async () => {
    const user = userEvent.setup();
    render(<SheetHarness side="left" />);
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    const root = document.querySelector('[data-side="left"]');
    expect(root).not.toBeNull();
    const dialog = screen.getByRole("dialog", { name: "Szczegóły" });
    expect((root as Element).contains(dialog)).toBe(true);
    expect(dialog.contains(active())).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

function PopoverHarness() {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button ref={anchor} type="button" onClick={() => setOpen((o) => !o)}>
        Widok
      </button>
      <Popover open={open} anchorRef={anchor} onClose={() => setOpen(false)} title="Ustawienia">
        <button type="button">Opcja</button>
      </Popover>
    </>
  );
}

describe("Popover", () => {
  it("opens as a dialog named by its title and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);
    await user.click(screen.getByRole("button", { name: "Widok" }));
    screen.getByRole("dialog", { name: "Ustawienia" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(active()).toBe(screen.getByRole("button", { name: "Widok" }));
  });

  it("closes on an outside mousedown but not on one inside", async () => {
    const user = userEvent.setup();
    render(<PopoverHarness />);
    await user.click(screen.getByRole("button", { name: "Widok" }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Opcja" }));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Star", () => {
  it("is a toggle button named Do planu that reports aria-pressed", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(<Star pressed={false} onToggle={onToggle} />);
    const star = screen.getByRole("button", { name: "Do planu" });
    expect(star.getAttribute("aria-pressed")).toBe("false");
    await user.click(star);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<Star pressed={true} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("Avatar", () => {
  it("computes initials from the first and last word", () => {
    expect(initials("Emil Biliński")).toBe("EB");
    expect(initials("Madonna")).toBe("M");
    expect(initials("  ")).toBe("?");
  });

  it("falls back to initials when the image fails to load", () => {
    const { container } = render(<Avatar name="Emil Biliński" src="https://example.invalid/emil.jpg" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(screen.queryByText("EB")).toBeNull();
    fireEvent.error(img as Element);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("EB")).not.toBeNull();
    expect(screen.getByRole("img", { name: "Emil Biliński" })).not.toBeNull();
  });

  it("renders initials directly when there is no photo", () => {
    render(<Avatar name="Karol Bartnik" src={null} hue={120} />);
    expect(screen.getByText("KB")).not.toBeNull();
  });
});

describe("Chip", () => {
  it("renders a remove button labelled with the chip text", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Prelekcja</Chip>);
    await user.click(screen.getByRole("button", { name: "Usuń filtr: Prelekcja" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("has no button without onRemove", () => {
    render(<Chip tone="accent">Tylko ulubione</Chip>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Tylko ulubione")).not.toBeNull();
  });
});

describe("Segmented", () => {
  it("is a radiogroup whose arrow keys move the selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Segmented
        value="grid"
        options={[
          { value: "grid", label: "Siatka" },
          { value: "list", label: "Lista" },
        ]}
        onChange={onChange}
        ariaLabel="Układ"
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Układ" });
    const grid = within(group).getByRole("radio", { name: "Siatka" });
    expect(grid.getAttribute("aria-checked")).toBe("true");
    grid.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("list");
    await user.click(within(group).getByRole("radio", { name: "Lista" }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("Slider", () => {
  it("shows the formatted value and reports numeric changes", () => {
    const onChange = vi.fn();
    render(<Slider value={15} min={5} max={45} step={5} onChange={onChange} label="Tolerancja" format={(v) => `${v} min`} />);
    expect(screen.getByText("15 min")).not.toBeNull();
    const input = screen.getByRole("slider", { name: "Tolerancja" });
    fireEvent.change(input, { target: { value: "20" } });
    expect(onChange).toHaveBeenCalledWith(20);
  });
});

describe("Toggle", () => {
  it("is a switch that reports the flipped value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Tylko ulubione" hint="Pokazuje tylko plan" />);
    const sw = screen.getByRole("switch", { name: "Tylko ulubione" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    await user.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("EmptyState", () => {
  it("renders title, text and actions", () => {
    render(
      <EmptyState title="Brak wydarzeń dla tych filtrów" text="Spróbuj inne" actions={<button type="button">Wyczyść filtry</button>} illustration />,
    );
    expect(screen.getByRole("status")).not.toBeNull();
    expect(screen.getByText("Brak wydarzeń dla tych filtrów")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Wyczyść filtry" })).not.toBeNull();
  });
});

describe("CopySheet", () => {
  afterEach(() => {
    useStore.setState({ openSheet: null, copyText: null });
  });

  it("shows the copy text in a read-only, pre-selected textarea and clears it on close", async () => {
    const user = userEvent.setup();
    const text = "Piątek, 4 września\n09:30–10:30 · Sesja · Sala wykł. 1";
    useStore.setState({ openSheet: "copy", copyText: text });
    render(<CopySheet />);
    screen.getByRole("dialog", { name: "Skopiuj ręcznie" });
    const textarea = screen.getByRole("textbox", { name: "Tekst do skopiowania" }) as HTMLTextAreaElement;
    expect(textarea.readOnly).toBe(true);
    expect(textarea.value).toBe(text);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(text.length);
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(useStore.getState().openSheet).toBeNull();
    expect(useStore.getState().copyText).toBeNull();
  });

  it("renders nothing while no copy text is pending", () => {
    useStore.setState({ openSheet: null, copyText: null });
    render(<CopySheet />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("useMediaQuery", () => {
  it("reads matchMedia and resolves the tier", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query === "(min-width: 1100px)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
    try {
      const wide = renderHook(() => useMediaQuery("(min-width: 1100px)"));
      expect(wide.result.current).toBe(true);
      const tier = renderHook(() => useTier());
      expect(tier.result.current).toBe("wide");
    } finally {
      Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: original });
    }
  });
});
