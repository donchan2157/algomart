import { ReactNode } from 'react'

import Card from './card'

import Heading from '@/components/heading'

export interface CardProps {
  cards: {
    handleClick: () => void
    helpText: string
    icon: ReactNode
    method: string
    title: string
  }[]
  header: string
}

export default function Cards({ cards, header }: CardProps) {
  return (
    <>
      {header && (
        <Heading className="mb-10" level={1}>
          {header}
        </Heading>
      )}
      <ul>
        {cards.map(({ handleClick, helpText, icon, method, title }) => (
          <li key={method}>
            <Card
              handleClick={handleClick}
              helpText={helpText}
              icon={icon}
              title={title}
            />
          </li>
        ))}
      </ul>
    </>
  )
}