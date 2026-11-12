"use client";

import { useEffect, useRef } from "react";
import { formatNumber, formatTime } from "@/lib/format";
import type { FoodItem } from "@/lib/types";

const TIME_GROUPS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

type TimeGroup = (typeof TIME_GROUPS)[number];

function minutesOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Time-of-day fallback when a food row has no meal name.
 * Breakfast 5:00–10:59, lunch 11:00–14:59, dinner 17:00–20:59, otherwise snacks.
 */
function timeOfDay(time: string): TimeGroup {
  const mins = minutesOf(time);
  if (mins == null) return "Snacks";
  if (mins >= 5 * 60 && mins < 11 * 60) return "Breakfast";
  if (mins >= 11 * 60 && mins < 15 * 60) return "Lunch";
  if (mins >= 17 * 60 && mins < 21 * 60) return "Dinner";
  return "Snacks";
}

function groupName(food: FoodItem): string {
  const meal = food.meal?.trim();
  return meal ? meal : timeOfDay(food.time);
}

function kcalDigits(value: number): number {
  return Number.isInteger(value) ? 0 : 1;
}

function formatClock(time: string): string {
  return minutesOf(time) == null ? time : formatTime(time);
}

export function TodayFood({ foods, dateLabel }: { foods: FoodItem[]; dateLabel: string }) {
  const buckets = new Map<string, FoodItem[]>();
  for (const food of foods) {
    const name = groupName(food);
    const list = buckets.get(name) ?? [];
    list.push(food);
    buckets.set(name, list);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time) || a.item.localeCompare(b.item));
  }

  const names = [...buckets.keys()].sort((a, b) => {
    const ai = TIME_GROUPS.indexOf(a as TimeGroup);
    const bi = TIME_GROUPS.indexOf(b as TimeGroup);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    const at = buckets.get(a)?.[0]?.time ?? "";
    const bt = buckets.get(b)?.[0]?.time ?? "";
    return at.localeCompare(bt) || a.localeCompare(b);
  });

  const total = foods.reduce((sum, food) => sum + food.kcal, 0);
  const tileRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tile = tileRef.current;
    const list = listRef.current;
    if (!tile || !list) return;

    const naturalHeight = (node: HTMLElement) => {
      const style = getComputedStyle(node);
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      let kids = 0;
      for (const child of node.children) kids += (child as HTMLElement).offsetHeight;
      const gap = parseFloat(style.rowGap || style.gap || "0") || 0;
      return kids + pad + border + Math.max(0, node.children.length - 1) * gap;
    };

    const fit = () => {
      const row = tile.parentElement;
      if (!row) return;
      const tileTop = tile.getBoundingClientRect().top;
      const siblings = [...row.children].filter((el) => {
        if (el === tile) return false;
        return Math.abs((el as HTMLElement).getBoundingClientRect().top - tileTop) < 8;
      }) as HTMLElement[];
      if (siblings.length === 0) {
        list.style.maxHeight = "";
        return;
      }
      const rowHeight = Math.max(...siblings.map(naturalHeight));
      const style = getComputedStyle(tile);
      const pad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const gap = parseFloat(style.rowGap || style.gap || "0") || 0;
      const heading = tile.querySelector(".tile-heading")?.getBoundingClientRect().height ?? 0;
      const totalRow = tile.querySelector(".food-total")?.getBoundingClientRect().height ?? 0;
      const gaps = gap * Math.max(0, tile.children.length - 1);
      const max = Math.max(72, Math.floor(rowHeight - pad - border - heading - totalRow - gaps));
      list.style.maxHeight = `${max}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    const row = tile.parentElement;
    if (row) {
      for (const child of row.children) {
        if (child !== tile) observer.observe(child);
      }
    }
    window.addEventListener("resize", fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [foods]);

  return (
    <section
      className="card food-tile"
      aria-labelledby="todays-food-title"
      data-tab-group="diet"
      data-tile="food"
      ref={tileRef}
    >
      <div className="tile-heading">
        <h2 id="todays-food-title">Today&apos;s food</h2>
        {dateLabel ? <p className="tile-meta">{dateLabel}</p> : null}
      </div>
      {foods.length === 0 ? (
        <p className="food-empty">No food logged.</p>
      ) : (
        <div className="food-list" ref={listRef}>
          {names.map((name) => {
            const items = buckets.get(name) ?? [];
            return (
              <div key={name} className="food-group">
                <h3>{name}</h3>
                <ul>
                  {items.map((food, index) => (
                    <li key={food.id ?? `${food.time}-${food.item}-${index}`}>
                      <span className="food-time">{formatClock(food.time)}</span>
                      <span className="food-item">{food.item}</span>
                      <span className="food-kcal">
                        {formatNumber(food.kcal, kcalDigits(food.kcal))}
                        <span className="unit">kcal</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      <div className="food-total">
        <span>Total</span>
        <span>{formatNumber(total, kcalDigits(total))} kcal</span>
      </div>
    </section>
  );
}
