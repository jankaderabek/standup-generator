<template>
  <UContainer>
    <UCard class="my-8">
      <template #header>
        <div class="prose dark:prose-invert prose-sm">
          <h1 class="title">Generate your standup report</h1>
        </div>
      </template>

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="submit">
        <UFormGroup label="GitHub token" name="githubToken" required>
          <UInput v-model="state.githubToken" type="password" />
        </UFormGroup>

        <UFormGroup label="GitHub user name" name="githubUserName" required>
          <UInput v-model="state.githubUserName" />
        </UFormGroup>

        <UFormGroup
          label="Repository owner"
          name="repositoryOwner"
          help="Company account name or your account name"
          required
        >
          <UInput v-model="state.repositoryOwner" />
        </UFormGroup>

        <UFormGroup
          label="Repository name"
          name="repositoryName"
          help="Load GitHub events for the given repository"
          required
        >
          <UInput v-model="state.repositoryName" />
        </UFormGroup>

        <UFormGroup label="OpenAI token" name="openAIToken" required>
          <UInput v-model="state.openAIToken" type="password" />
        </UFormGroup>

        <UButton type="submit" :loading="loading">
          <template v-if="loading">Generating report</template>
          <template v-else>Generate report</template>
        </UButton>
      </UForm>

      <template v-if="responseMessage" #footer>
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="prose dark:prose-invert"
          v-html="MarkdownIt().render(responseMessage)"
        ></div>
      </template>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { ref } from "vue";
import { object, string, type InferType } from "yup";
import type { FormSubmitEvent } from "@nuxt/ui/dist/runtime/types";

const schema = object({
  githubToken: string().required("Required"),
  githubUserName: string().required("Required"),
  repositoryOwner: string().required("Required"),
  repositoryName: string().required("Required"),
  openAIToken: string().required("Required"),
});

type Schema = InferType<typeof schema>;

const state = ref({
  githubToken: undefined,
  githubUserName: undefined,
  repositoryOwner: undefined,
  repositoryName: undefined,
  openAIToken: undefined,
});

const loading = ref(false);
const responseMessage = ref<string | null>(null);
const persistedFormDataKey = "formData";

onMounted(() => {
  const formData = window.localStorage.getItem(persistedFormDataKey);

  if (formData) {
    state.value = JSON.parse(formData);
  }
});

async function submit(event: FormSubmitEvent<Schema>) {
  window.localStorage.setItem(persistedFormDataKey, JSON.stringify(event.data));
  loading.value = true;

  try {
    const response = await $fetch("/api/events", {
      method: "POST",
      body: event.data,
    });

    responseMessage.value = response.chatResponse.choices[0].message.content;
  } finally {
    loading.value = false;
  }
}
</script>
