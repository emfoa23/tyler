<script>
  let list = $state([])

  const appendNumber = () => {
    const numbers = Array(6)
      .fill()
      .map((_) => Math.floor(Math.random() * 45) + 1)
      .sort((a, b) => a - b)

    list = [...list, numbers]
  }

  const getBackGroundColor = (number) => {
    if (number <= 10) return 'bg-yellow-500'
    if (number <= 20) return 'bg-blue-500'
    if (number <= 30) return 'bg-red-500'

    return 'bg-green-500'
  }
</script>

<div class="container mx-auto">
  <div class="flex flex-col gap-10">
    <h1>로또번호 생성기</h1>

    <div>
      <button onclick={appendNumber}>로또번호 생성</button>
    </div>

    <div class="flex flex-col gap-3">
      {#each list as numbers}
        <div class="flex gap-3">
          {#each numbers as number}
            <div class={`h-15 w-15 content-center rounded-full text-xl font-bold ${getBackGroundColor(number)}`}>{number}</div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
