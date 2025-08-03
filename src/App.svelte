<script>
  let list = $state([])

  const appendNumber = () => {
    list = [...list, getUniqueRandomNumbers()]
  }

  const getUniqueRandomNumbers = () => {
    const numbers = new Set()

    while (numbers.size < 6) {
      numbers.add(Math.floor(Math.random() * 45) + 1)
    }

    return [...numbers].sort((a, b) => a - b)
  }

  const getBackGroundColor = (number) => {
    if (number <= 10) return 'bg-yellow-500'
    if (number <= 20) return 'bg-blue-500'
    if (number <= 30) return 'bg-red-500'

    return 'bg-green-500'
  }
</script>

<div class="flex h-[90vh] flex-col">
  <div class="flex-none p-4">
    <h1 class="mb-4">로또번호 생성기</h1>
    <div class="mb-4">
      <button onclick={appendNumber}>로또번호 생성</button>
    </div>
  </div>

  <div class="flex overflow-y-auto p-4">
    <div class="flex flex-col gap-3">
      {#each list as numbers}
        <div class="flex gap-3">
          {#each numbers as number}
            <div class={`h-10 w-10 content-center rounded-full font-bold ${getBackGroundColor(number)}`}>{number}</div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
