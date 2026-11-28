"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:bg-black hover:text-white hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 h-7 w-7 bg-transparent p-0 opacity-50 hover:bg-black hover:text-white hover:opacity-100"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].range_end)]:rounded-r-md [&:has([aria-selected].outside)]:bg-black/50 [&:has([aria-selected])]:bg-black first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal hover:bg-black hover:text-white focus:bg-black focus:text-white aria-selected:opacity-100"
        ),
        range_end: "range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-black text-white",
        outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-black/50 aria-selected:text-white aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-black aria-selected:text-white",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...props }) =>
          orientation === "left" ? (
            <ChevronLeftIcon {...props} className="h-4 w-4" />
          ) : (
            <ChevronRightIcon {...props} className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
