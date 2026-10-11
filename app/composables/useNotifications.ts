export function useNotifications() {
  const messages = useState<Array<{ id: string; text: string; error: boolean }>>('notifications', () => [])
  function notify(text: string, error = false) {
    const id = crypto.randomUUID(); messages.value.push({ id, text, error })
    setTimeout(() => { messages.value = messages.value.filter(m => m.id !== id) }, error ? 9000 : 4500)
  }
  return { messages, notify, dismiss: (id: string) => { messages.value = messages.value.filter(m => m.id !== id) } }
}
