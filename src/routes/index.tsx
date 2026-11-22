import { createFileRoute } from "@tanstack/react-router";
import { PapuRoot } from "@/components/papu/app";

export const Route = createFileRoute("/")({ component: PapuRoot });
