export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Drink'

export type WeekDay = { dow: string; num: number; kcal: number; c: number; p: number; f: number }

export type MockItem = { name: string; kcal: number; c: number; p: number; f: number }

export type MockMeal = {
  id: string
  type: MealType
  time: string
  kcal: number
  items: MockItem[]
  c: number
  p: number
  f: number
}

export type LabelInfo = { id: string; name: string; ic: string; tone: string }

export type TodayData = {
  date: string
  dateShort: string
  weekDays: WeekDay[]
  todayIdx: number
  goal: { kcal: number; c: number; p: number; f: number }
  consumed: { kcal: number; c: number; p: number; f: number }
  labels: LabelInfo[]
  meals: MockMeal[]
}

export const TODAY_DATA: TodayData = {
  date: 'Mon, May 4',
  dateShort: 'May 4',
  weekDays: [
    { dow: 'T', num: 28, kcal: 2080, c: 240, p: 142, f: 65 },
    { dow: 'W', num: 29, kcal: 2210, c: 252, p: 158, f: 70 },
    { dow: 'T', num: 30, kcal: 2640, c: 290, p: 132, f: 96 },
    { dow: 'F', num: 1, kcal: 2150, c: 248, p: 155, f: 68 },
    { dow: 'S', num: 2, kcal: 2380, c: 280, p: 130, f: 82 },
    { dow: 'S', num: 3, kcal: 2090, c: 240, p: 150, f: 65 },
    { dow: 'M', num: 4, kcal: 1284, c: 142, p: 98, f: 41 },
  ],
  todayIdx: 6,
  goal: { kcal: 2200, c: 250, p: 160, f: 70 },
  consumed: { kcal: 1284, c: 142, p: 98, f: 41 },
  labels: [{ id: 'office', name: 'Office', ic: 'briefcase', tone: 'blue' }],
  meals: [
    {
      id: 'b',
      type: 'Breakfast',
      time: '08:12',
      kcal: 412,
      items: [
        { name: 'Greek yogurt, 200g', kcal: 192, c: 12, p: 20, f: 6 },
        { name: 'Granola, 40g', kcal: 178, c: 28, p: 4, f: 6 },
        { name: 'Blueberries, 80g', kcal: 42, c: 10, p: 1, f: 0 },
      ],
      c: 50, p: 25, f: 12,
    },
    {
      id: 'l',
      type: 'Lunch',
      time: '13:04',
      kcal: 612,
      items: [
        { name: 'Chicken & rice bowl', kcal: 540, c: 62, p: 48, f: 14 },
        { name: 'Side salad, olive oil', kcal: 72, c: 4, p: 1, f: 6 },
      ],
      c: 66, p: 49, f: 20,
    },
    {
      id: 's',
      type: 'Snack',
      time: '16:30',
      kcal: 260,
      items: [
        { name: 'Protein bar', kcal: 210, c: 22, p: 22, f: 8 },
        { name: 'Black coffee', kcal: 5, c: 1, p: 0, f: 0 },
        { name: 'Apple', kcal: 45, c: 11, p: 0, f: 0 },
      ],
      c: 26, p: 22, f: 8,
    },
  ],
}
