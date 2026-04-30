import { redirect } from "next/navigation";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const userIdValue = params.userId;
  const userId = Array.isArray(userIdValue) ? userIdValue[0] : userIdValue;

  if (userId && userId.trim() !== "") {
    redirect(`/quiz?userId=${encodeURIComponent(userId)}`);
  }

  redirect("/quiz");
}
