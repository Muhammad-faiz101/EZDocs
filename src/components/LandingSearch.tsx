"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function LandingSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(
      trimmed ? `/services?q=${encodeURIComponent(trimmed)}` : "/services"
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex max-w-lg gap-2">
      <label htmlFor="service-search" className="sr-only">
        Search for a service
      </label>
      <input
        id="service-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a service, e.g. domicile"
        className="input h-11"
      />
      <button type="submit" className="btn btn-primary h-11 px-5">
        Search
      </button>
    </form>
  );
}
